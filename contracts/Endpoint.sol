// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./MerklePatriciaProof.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

// interface ITargetInterpreter {
//     function xReceive(bytes calldata payload) external;
// }

contract Endpoint {
    uint public chainId;

    event XSend(
        uint indexed targetChainId,
        address indexed targetInterpreter,
        bytes4 indexed funcSig,
        bytes payload
    );
    event Payload(bytes);
    event Response(bool);

    constructor(uint _chainId) {
        chainId = _chainId;
    }

    function xSend(
        uint targetChainId,
        address targetInterpreter,
        bytes4 funcSig, // string func
        bytes calldata payload
    ) external {
        emit XSend(targetChainId, targetInterpreter, funcSig, payload);
    }

    function xReceive(
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        bytes32 root
    ) public {
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
            address sourceEndpoint = RLPReader.toAddress(logValue[0]); // sourceEndpoint
            RLPReader.RLPItem[] memory topics = RLPReader.toList(logValue[1]); // topics
            bytes32 eventSig = bytes32(RLPReader.toBytes(topics[0])); // eventSig

            // sourceEndpoint in whitelist && eventSig matches
            if (checkSource(sourceEndpoint, eventSig)) {
                uint targetChainId = RLPReader.toUint(topics[1]); // targetChainId
                if (checkChainId(targetChainId)) {
                    address targetInterpreter = abi.decode(
                        RLPReader.toBytes(topics[2]),
                        (address)
                    ); // targetIntepreter
                    bytes4 funcSig = bytes4(RLPReader.toBytes(topics[3])); // funcSig
                    bytes memory payload = abi.decode(
                        RLPReader.toBytes(logValue[2]),
                        (bytes)
                    ); // data/payload
                    bytes memory call_data = abi.encodeWithSelector(
                        funcSig,
                        payload
                    ); // abi.encodeWithSignature("test(bytes)", payload)

                    // return call_data;
                    (bool success, bytes memory data) = targetInterpreter.call(
                        call_data
                    );
                    emit Payload(payload);
                    emit Response(success);
                }
            }
        }
    }

    // whitelist
    function checkSource(
        address sourceEndpoint,
        bytes32 eventSig
    ) private pure returns (bool) {
        // console.log(sourceEndpoint);
        // console.log(eventSig);
        if (
            eventSig ==
            0x84bb3894b4ad95ba3cb7feb390b993fd1ebcc028850da4593e0b252e87d9d5e7
        ) {
            return true;
        } else {
            return false;
        }
    }

    function checkChainId(uint targetChainId) private view returns (bool) {
        // console.log(targetChainId);
        if (chainId == targetChainId) {
            return true;
        } else {
            return false;
        }
    }
}
