// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./lib/BytesLib.sol";
import "./LightClient.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface ILightClient {
    function submitBlockHeader(uint, bytes calldata) external;

    function hasBlockHeader(uint) external view returns (bool);

    function getStateRootByBlockHeader(uint) external view returns (bytes32);

    function getReceiptRootByBlockHeader(uint) external view returns (bytes32);

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

    // mapping(bytes32 => address) public called; // called querys
    mapping(bytes32 => bool) public responsed; // responsed querys

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
    event XReceive(bytes32 indexed key);
    event XCall(
        address indexed sourceContract,
        uint indexed targetChainId,
        uint indexed blockNumber,
        address targetAccount
    );
    event Payload(address indexed targetContract, bytes payload);
    event Response(bool success);
    event StorageHash(bytes32 storageHash);

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
            ILightClient(lightClients[_chainId]).hasBlockHeader(blockNumber) ==
                false
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
            ILightClient(lightClients[_chainId]).hasBlockHeader(blockNumber) ==
                true
        );
        ILightClient(lightClients[_chainId]).submitBlockHeader(
            blockNumber,
            rlpBlockHeader
        );
        emit UpdateBlockHeader(_chainId, blockNumber);
    }

    function getStateRootByBlockHeader(
        uint _chainId,
        uint blockNumber
    ) external view returns (bytes32) {
        return
            ILightClient(lightClients[_chainId]).getStateRootByBlockHeader(
                blockNumber
            );
    }

    function getReceiptRootByBlockHeader(
        uint _chainId,
        uint blockNumber
    ) external view returns (bytes32) {
        return
            ILightClient(lightClients[_chainId]).getReceiptRootByBlockHeader(
                blockNumber
            );
    }

    function xSend(
        uint targetChainId,
        address targetContract,
        bytes calldata payload
    ) external {
        emit XSend(msg.sender, targetChainId, targetContract, payload);
    }

    function xReceive(
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

                    emit Payload(targetContract, payload);
                    (bool success, ) = targetContract.call(payload);
                    emit Response(success);
                    require(success, "Failed to call target contract.");
                }
            }
        }
        received[key] = true;
        emit XReceive(key);
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
        address targetAccount
        // bytes32 slot,
    ) external // fallback funcSig
    {
        // bytes32 key = keccak256(
        //     abi.encodePacked(msg.sender, targetChainId, blockNumber, targetAccount)
        // );
        // called[key] = msg.sender;
        emit XCall(msg.sender, targetChainId, blockNumber, targetAccount);
    }

    function xResponse(
        address sourceContract,
        uint targetChainId,
        uint blockNumber,
        address targetAccount,
        bytes calldata rlpAccountProof
    ) external {
        bytes32 key = keccak256(
            abi.encodePacked(
                sourceContract,
                targetChainId,
                blockNumber,
                targetAccount
            )
        );
        require(responsed[key] == false, "Passing responsed query.");
        bytes memory path = abi.encodePacked(
            keccak256(abi.encodePacked(targetAccount))
        );
        bytes memory account = ILightClient(lightClients[targetChainId])
            .extractAccountFromProof(path, rlpAccountProof, blockNumber);
        RLPReader.RLPItem[] memory accountFields = account.toRlpItem().toList();
        uint nonce = accountFields[0].toUint();
        uint balance = accountFields[1].toUint();
        bytes32 storageHash = bytes32(accountFields[2].toBytes());
        bytes32 codeHash = bytes32(accountFields[3].toBytes());
        emit StorageHash(storageHash);
    }
}
