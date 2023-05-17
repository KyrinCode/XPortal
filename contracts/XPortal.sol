// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./lib/BytesLib.sol";
import "./LightClient.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface ILightClient {
    function submitBlockHeader(uint, bytes calldata) external;

    function getBlockHash(uint) external view returns (bytes32);

    function getStateRoot(uint) external view returns (bytes32);

    function getReceiptRoot(uint) external view returns (bytes32);

    function extractReceiptFromProof(
        bytes calldata,
        bytes calldata,
        uint
    ) external view returns (bytes memory);

    function extractAccountFromProof(
        bytes calldata,
        bytes calldata,
        uint
    ) external view returns (bytes memory);

    function extractSlotValueFromProof(
        bytes calldata,
        bytes calldata,
        bytes32
    ) external pure returns (bytes memory);
}

contract XPortal {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;
    using BytesLib for bytes;

    address public manager;
    uint public chainId;

    mapping(uint => address) public xPortals; // chainId => xPortal
    mapping(uint => address) public lightClients; // chainId => lightClient

    mapping(bytes32 => bool) public received; // received payloads
    mapping(bytes32 => bool) public responded; // responded querys

    struct Account {
        uint nonce;
        uint balance;
        bytes32 storageHash;
        bytes32 codeHash;
    }

    event AddXPortal(
        uint indexed chainId,
        address indexed xPortal,
        address indexed lightClient
    );
    event SubmitBlockHeader(uint indexed chainId, uint indexed blockNumber);
    event UpdateBlockHeader(uint indexed chainId, uint indexed blockNumber);
    event XSend(
        address indexed sourceContract,
        uint indexed targetChainId,
        address indexed targetContract,
        bytes payload
    );
    event XReceive(
        bytes32 indexed key,
        address indexed targetContract,
        bytes payload
    );
    event XCall(
        address indexed sourceContract,
        uint indexed targetChainId,
        uint indexed blockNumber,
        address targetAccount,
        bytes32[] slots
    );
    event XRespond(bytes32 indexed key, address indexed sourceContract);

    constructor(uint _chainId) {
        manager = msg.sender;
        chainId = _chainId;
    }

    modifier onlyManager() {
        require(msg.sender == manager);
        _;
    }

    function addXPortal(uint _chainId, address _xPortal) external onlyManager {
        xPortals[_chainId] = _xPortal;
        address newLightClient = createLightClient(_chainId); // create light client
        emit AddXPortal(_chainId, _xPortal, newLightClient);
    }

    function createLightClient(uint _chainId) private returns (address) {
        address newLightClient = address(new LightClient(address(this)));
        lightClients[_chainId] = newLightClient;
        return newLightClient;
    }

    // todo: new Validator contract to verify if validator or not
    modifier onlyValidator() {
        require(msg.sender == manager);
        _;
    }

    function submitBlockHeader(
        uint _chainId,
        uint blockNumber,
        bytes calldata rlpBlockHeader
    ) external onlyValidator {
        require(
            ILightClient(lightClients[_chainId]).getBlockHash(blockNumber) ==
                0x0000000000000000000000000000000000000000000000000000000000000000
        );
        ILightClient(lightClients[_chainId]).submitBlockHeader(
            blockNumber,
            rlpBlockHeader
        );
        emit SubmitBlockHeader(_chainId, blockNumber);
    }

    function updateBlockHeader(
        uint _chainId,
        uint blockNumber,
        bytes calldata rlpBlockHeader
    ) external onlyValidator {
        require(
            ILightClient(lightClients[_chainId]).getBlockHash(blockNumber) !=
                0x0000000000000000000000000000000000000000000000000000000000000000
        );
        ILightClient(lightClients[_chainId]).submitBlockHeader(
            blockNumber,
            rlpBlockHeader
        );
        emit UpdateBlockHeader(_chainId, blockNumber);
    }

    function getBlockHash(uint _chainId, uint blockNumber) external view returns (bytes32) {
        return ILightClient(lightClients[_chainId]).getBlockHash(blockNumber);
    }

    function getStateRoot(
        uint _chainId,
        uint blockNumber
    ) external view returns (bytes32) {
        return ILightClient(lightClients[_chainId]).getStateRoot(blockNumber);
    }

    function getReceiptRoot(
        uint _chainId,
        uint blockNumber
    ) external view returns (bytes32) {
        return ILightClient(lightClients[_chainId]).getReceiptRoot(blockNumber);
    }

    function xSend(
        uint targetChainId,
        address targetContract,
        bytes calldata payload
    ) external {
        emit XSend(msg.sender, targetChainId, targetContract, payload);
    }

    function xReceive( // 怎么保证source有权限
        uint sourceChainId,
        bytes calldata path,
        bytes calldata rlpReceiptProof,
        uint blockNumber
    ) external {
        bytes32 key = keccak256(
            abi.encodePacked(sourceChainId, blockNumber, path)
        );
        require(received[key] == false, "Passing received receipt.");
        bytes memory receipt = ILightClient(lightClients[sourceChainId])
            .extractReceiptFromProof(path, rlpReceiptProof, blockNumber);

        RLPReader.RLPItem[] memory logs = parseLogs(receipt);
        for (uint i = 0; i < logs.length; i++) {
            RLPReader.RLPItem[] memory logValue = logs[i].toList();
            address sourceXPortal = logValue[0].toAddress(); // sourceXPortal
            RLPReader.RLPItem[] memory topics = logValue[1].toList(); // topics
            bytes32 eventSig = bytes32(topics[0].toBytes()); // eventSig
            if (
                sourceXPortal == xPortals[sourceChainId] &&
                eventSig ==
                0x82e806817932576004db2f6df876ee5a397c85d7c1ea6240f965fd1f94afe847
            ) {
                uint targetChainId = topics[2].toUint(); // targetChainId
                if (targetChainId == chainId) {
                    // check chainId
                    address targetContract = abi.decode(
                        topics[3].toBytes(),
                        (address)
                    ); // targetContract
                    bytes memory payload = abi.decode(
                        logValue[2].toBytes(),
                        (bytes)
                    ); // payload|calldata

                    (bool success, ) = targetContract.call(payload); // 避免重入攻击或哈希碰撞，这里应该阻止 targetContract 是 XPortal 本身或任何 lightclient，避免绕过限制更新区块头
                    require(success, "Failed to call target contract.");
                    emit XReceive(key, targetContract, payload);
                }
            }
        }
        received[key] = true;
    }

    function parseLogs(
        bytes memory value
    ) private pure returns (RLPReader.RLPItem[] memory) {
        RLPReader.RLPItem[] memory receiptValue = value
            .slice(1, value.length - 1)
            .toRlpItem()
            .toList();
        require(
            receiptValue[0].toUint() == 1,
            "Receipt status should equal to 1."
        );
        return receiptValue[3].toList();
    }

    function xCall(
        uint targetChainId,
        uint blockNumber,
        address targetAccount,
        bytes32[] calldata slots // fallback funcSig
    ) external {
        emit XCall(
            msg.sender,
            targetChainId,
            blockNumber,
            targetAccount,
            slots
        );
    }

    function xRespond(
        address sourceContract, // 怎么保证是这个source
        uint targetChainId,
        uint blockNumber,
        address targetAccount,
        bytes calldata rlpAccountProof,
        bytes32[] calldata slots,
        bytes[] calldata rlpStorageProof
    ) external {
        bytes32 key = keccak256(
            abi.encodePacked(
                sourceContract,
                targetChainId,
                blockNumber,
                targetAccount,
                slots
            )
        );
        require(responded[key] == false, "Passing responded query.");
        Account memory account = getAccountFields(
            targetChainId,
            targetAccount,
            rlpAccountProof,
            blockNumber
        );
        // emit StorageHash(storageHash);

        bytes32[] memory slotValues = getSlotValues(
            targetChainId,
            slots,
            rlpStorageProof,
            account.storageHash
        );

        (bool success, ) = sourceContract.call(
            abi.encodeWithSelector(
                0x00000000,
                account.nonce,
                account.balance,
                account.storageHash,
                account.codeHash,
                slotValues
            )
        );
        require(success, "Failed to call target contract.");
        emit XRespond(key, sourceContract);
        responded[key] == true;
    }

    function getAccountFields(
        uint targetChainId,
        address targetAccount,
        bytes calldata rlpAccountProof,
        uint blockNumber
    ) private view returns (Account memory) {
        bytes memory path = abi.encodePacked(
            keccak256(abi.encodePacked(targetAccount))
        );
        // bytes memory account = ;
        RLPReader.RLPItem[] memory accountFields = ILightClient(
            lightClients[targetChainId]
        )
            .extractAccountFromProof(path, rlpAccountProof, blockNumber)
            .toRlpItem()
            .toList();
        Account memory account;
        account.nonce = accountFields[0].toUint();
        account.balance = accountFields[1].toUint();
        account.storageHash = bytes32(accountFields[2].toBytes());
        account.codeHash = bytes32(accountFields[3].toBytes());
        return account;
    }

    function getSlotValues(
        uint targetChainId,
        bytes32[] calldata slots,
        bytes[] calldata rlpStorageProof,
        bytes32 storageHash
    ) private view returns (bytes32[] memory) {
        bytes32[] memory slotValues = new bytes32[](slots.length);
        for (uint i = 0; i < slots.length; i++) {
            bytes memory slotPath = abi.encodePacked(
                keccak256(abi.encodePacked(slots[i]))
            );
            bytes32 slotValue = bytes32(
                ILightClient(lightClients[targetChainId])
                    .extractSlotValueFromProof(
                        slotPath,
                        rlpStorageProof[i],
                        storageHash
                    )
            );
            slotValues[i] = slotValue;
        }
        return slotValues;
    }
}
