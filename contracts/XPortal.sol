// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./LightClient.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface ILightClient {
    function submitBlockHeader(bytes32, bytes calldata) external;

    function verifyReceiptProof(
        bytes calldata,
        bytes calldata,
        bytes calldata,
        bytes32
    ) external view returns (bool);

    function hasBlockHeader(bytes32) external view returns (bool);

    function getStateRootByBlockHeader(bytes32) external view returns (bytes32);

    function getReceiptRootByBlockHeader(
        bytes32
    ) external view returns (bytes32);
}

contract XPortal {
    address public manager;
    uint8 public chainId;

    mapping(uint8 => address) public xPortals; // chainId => xPortal
    mapping(uint8 => address) public lightClients; // chainId => lightClient
    mapping(bytes32 => bool) public finished; // finished payloads

    event XSend(
        uint8 indexed targetChainId,
        address indexed targetContract,
        bytes payload
    );
    event XReceive(bytes32 indexed key);
    event AddXPortal(
        uint8 indexed chainId,
        address indexed xPortal,
        address indexed lightClient
    );
    event SubmitBlockHeader(uint8 indexed chainId, bytes32 indexed blockHash);
    event UpdateBlockHeader(uint8 indexed chainId, bytes32 indexed blockHash);
    event Payload(address indexed targetContract, bytes payload);
    event Response(bool success);

    constructor(uint8 _chainId) {
        manager = msg.sender;
        chainId = _chainId;
    }

    modifier onlyManager() {
        require(msg.sender == manager);
        _;
    }

    function addXPortal(uint8 _chainId, address _xPortal) external onlyManager {
        xPortals[_chainId] = _xPortal;
        address newLightClient = createLightClient(_chainId); // create light client
        emit AddXPortal(_chainId, _xPortal, newLightClient);
    }

    function createLightClient(uint8 _chainId) private returns (address) {
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
        uint8 _chainId,
        bytes32 blockHash,
        bytes calldata rlpBlockHeader
    ) external onlyValidator {
        require(
            ILightClient(lightClients[_chainId]).hasBlockHeader(blockHash) ==
                false
        );
        ILightClient(lightClients[_chainId]).submitBlockHeader(
            blockHash,
            rlpBlockHeader
        );
        emit SubmitBlockHeader(_chainId, blockHash);
    }

    function updateBlockHeader(
        uint8 _chainId,
        bytes32 blockHash,
        bytes calldata rlpBlockHeader
    ) external onlyValidator {
        require(
            ILightClient(lightClients[_chainId]).hasBlockHeader(blockHash) ==
                true
        );
        ILightClient(lightClients[_chainId]).submitBlockHeader(
            blockHash,
            rlpBlockHeader
        );
        emit UpdateBlockHeader(_chainId, blockHash);
    }

    function getStateRootByBlockHeader(
        uint8 _chainId,
        bytes32 blockHash
    ) external view returns (bytes32) {
        return
            ILightClient(lightClients[_chainId]).getStateRootByBlockHeader(
                blockHash
            );
    }

    function getReceiptRootByBlockHeader(
        uint8 _chainId,
        bytes32 blockHash
    ) external view returns (bytes32) {
        return
            ILightClient(lightClients[_chainId]).getReceiptRootByBlockHeader(
                blockHash
            );
    }

    function xSend(
        uint8 targetChainId,
        address targetContract,
        bytes calldata payload
    ) external {
        emit XSend(targetChainId, targetContract, payload);
    }

    function xReceive(
        uint8 sourceChainId,
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        bytes32 blockHash
    ) external {
        bytes32 key = keccak256(
            abi.encodePacked(sourceChainId, blockHash, encodedPath)
        );
        require(!checkFinished(key), "Passing finished receipt.");
        require(
            verifyReceiptProof(
                sourceChainId,
                value,
                encodedPath,
                rlpParentNodes,
                blockHash
            ),
            "Failed to pass MPT proof verification."
        );

        RLPReader.RLPItem[] memory logs = parseLogs(value);
        for (uint i = 0; i < logs.length; i++) {
            RLPReader.RLPItem[] memory logValue = RLPReader.toList(logs[i]);
            address sourceXPortal = RLPReader.toAddress(logValue[0]); // sourceXPortal
            RLPReader.RLPItem[] memory topics = RLPReader.toList(logValue[1]); // topics
            bytes32 eventSig = bytes32(RLPReader.toBytes(topics[0])); // eventSig
            if (checkSource(sourceChainId, sourceXPortal, eventSig)) {
                uint8 targetChainId = uint8(RLPReader.toUint(topics[1])); // targetChainId
                if (checkChainId(targetChainId)) {
                    address targetContract = abi.decode(
                        RLPReader.toBytes(topics[2]),
                        (address)
                    ); // targetContract
                    bytes memory payload = abi.decode(
                        RLPReader.toBytes(logValue[2]),
                        (bytes)
                    ); // payload|calldata

                    emit Payload(targetContract, payload);
                    (bool success, ) = targetContract.call(payload);
                    emit Response(success);
                    require(success, "Failed to call target contract.");
                }
            }
        }
        finished[key] = true;
        emit XReceive(key);
    }

    function checkFinished(bytes32 key) private view returns (bool) {
        if (finished[key] == true) {
            return true;
        } else {
            return false;
        }
    }

    function verifyReceiptProof(
        uint8 _chainId,
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        bytes32 blockHash
    ) private view returns (bool) {
        bool success = ILightClient(lightClients[_chainId]).verifyReceiptProof(
            value,
            encodedPath,
            rlpParentNodes,
            blockHash
        );
        return success;
    }

    function parseLogs(
        bytes calldata value
    ) private pure returns (RLPReader.RLPItem[] memory) {
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(value[1:]);
        RLPReader.RLPItem[] memory receiptValue = RLPReader.toList(item);
        require(
            RLPReader.toUint(receiptValue[0]) == 1,
            "Receipt status should equal to 1."
        );
        return RLPReader.toList(receiptValue[3]);
    }

    // whitelist
    function checkSource(
        uint8 sourceChainId,
        address sourceXPortal,
        bytes32 eventSig
    ) private view returns (bool) {
        if (
            sourceXPortal == xPortals[sourceChainId] &&
            eventSig ==
            0xadae96a91bc2e10eb5e85d5fddf15e9ba2aeea50b6bd0184314cfc133ba67a91
        ) {
            return true;
        } else {
            return false;
        }
    }

    function checkChainId(uint8 targetChainId) private view returns (bool) {
        // console.log(targetChainId);
        if (chainId == targetChainId) {
            return true;
        } else {
            return false;
        }
    }
}
