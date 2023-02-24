// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./lib/RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Test {
    function testAbiEncodePacked(address a) public pure returns (bytes memory) {
        return abi.encodePacked(keccak256(abi.encodePacked(a)));
    }

    function testFunctionAndPayload() public pure returns (bytes memory) {
        // bytes memory x = "0x05";
        // bytes memory y = "0x74657874";
        // bytes memory result = abi.encodeWithSignature("test(uint,string)", 5, "text");
        bytes4 selector = 0x2f570a23;
        bytes memory payload = fromHex("c6058474657874");
        // bytes memory result = abi.encodeWithSignature("test(bytes)", payload);
        bytes memory result = abi.encodeWithSelector(selector, payload);
        return result;
    }

    function testParseValue(bytes calldata value) public pure returns (uint) {
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(value[1:]);
        RLPReader.RLPItem[] memory receiptValue = RLPReader.toList(item);
        return RLPReader.toUint(receiptValue[0]);
    }

    // Convert an hexadecimal character to their value
    function fromHexChar(uint8 c) public pure returns (uint8) {
        if (bytes1(c) >= bytes1("0") && bytes1(c) <= bytes1("9")) {
            return c - uint8(bytes1("0"));
        }
        if (bytes1(c) >= bytes1("a") && bytes1(c) <= bytes1("f")) {
            return 10 + c - uint8(bytes1("a"));
        }
        if (bytes1(c) >= bytes1("A") && bytes1(c) <= bytes1("F")) {
            return 10 + c - uint8(bytes1("A"));
        }
        revert("fail");
    }

    // Convert an hexadecimal string to raw bytes
    function fromHex(string memory s) public pure returns (bytes memory) {
        bytes memory ss = bytes(s);
        require(ss.length % 2 == 0); // length must be even
        bytes memory r = new bytes(ss.length / 2);
        for (uint i = 0; i < ss.length / 2; ++i) {
            r[i] = bytes1(
                fromHexChar(uint8(ss[2 * i])) *
                    16 +
                    fromHexChar(uint8(ss[2 * i + 1]))
            );
        }
        return r;
    }
}
