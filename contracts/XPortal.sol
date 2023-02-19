// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./MerklePatriciaProof.sol";
import "./LightClient.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract XPortal {
    address public manager;
    uint8 public chainId;

    mapping(address => uint8) public xPortals;

    event XSend(
        uint8 indexed targetChainId,
        address indexed targetContract,
        bytes payload
    );
    event AddXPortal(uint8, address);
    event Payload(bytes);
    event Response(bool);

    constructor(uint8 _chainId) {
        manager = msg.sender;
        chainId = _chainId;
    }

    modifier onlyManager() {
        require(msg.sender == manager);
        _;
    }

    function addXPortal(uint8 _chainId, address _xPortal) external onlyManager {
        xPortals[_xPortal] = _chainId;
        // create light client
        emit AddXPortal(_chainId, _xPortal);
    }

    function xSend(
        uint8 targetChainId,
        address targetContract,
        bytes calldata payload
    ) external {
        emit XSend(targetChainId, targetContract, payload);
    }

    function xReceive(
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        bytes32 root
    ) external {
        require(
            MerklePatriciaProof.verify(
                value,
                encodedPath,
                rlpParentNodes,
                root
            ),
            "Not pass MPT proof verification."
        );
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(value[1:]);
        RLPReader.RLPItem[] memory receiptValue = RLPReader.toList(item);
        require(RLPReader.toUint(receiptValue[0]) == 1);
        RLPReader.RLPItem[] memory logs = RLPReader.toList(receiptValue[3]);

        for (uint i = 0; i < logs.length; i++) {
            RLPReader.RLPItem[] memory logValue = RLPReader.toList(logs[i]);
            address sourceXPortal = RLPReader.toAddress(logValue[0]); // sourceXPortal
            RLPReader.RLPItem[] memory topics = RLPReader.toList(logValue[1]); // topics
            bytes32 eventSig = bytes32(RLPReader.toBytes(topics[0])); // eventSig

            // sourceXPortal in whitelist && eventSig matches
            if (checkSource(sourceXPortal, eventSig)) {
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
                    // emit Payload(payload);
                    (bool success, ) = targetContract.call(payload);
                    emit Response(success);
                    require(success);
                }
            }
        }
    }

    // whitelist
    function checkSource(
        address sourceXPortal,
        bytes32 eventSig
    ) private view returns (bool) {
        if (
            xPortals[sourceXPortal] != 0 &&
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
