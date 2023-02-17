// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface ITarget {
    function receive0(uint, string calldata) external;
    function receive1(string calldata, bytes calldata) external;
}

contract TargetInterpreter {
    address public target;

    function updateTarget(address _target) public {
        target = _target;
    }

    function receive0(bytes calldata payload) external {
        // rlp version
        // RLPReader.RLPItem memory item = RLPReader.toRlpItem(payload);
        // RLPReader.RLPItem[] memory payloadValue = RLPReader.toList(item);
        // uint val = RLPReader.toUint(payloadValue[0]); // uint
        // string memory s = string(RLPReader.toBytes(payloadValue[1])); // string

        // abiEncode version
        (uint val, string memory s) = abi.decode(payload, (uint, string));
        ITarget(target).receive0(val, s);
    }

    function receive1(bytes calldata payload) external {
        (string memory s, bytes memory b) = abi.decode(payload, (string, bytes));
        ITarget(target).receive1(s, b);
    }
}