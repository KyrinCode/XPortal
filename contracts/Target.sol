// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Target {
    uint public val1;
    string public s1;

    string public s2;
    bytes public b2;

    function receive1(uint _val, string calldata _s) public {
        val1 = _val;
        s1 = _s;
    }

    function receive2(string calldata _s, bytes calldata _b) public {
        s2 = _s;
        b2 = _b;
    }
}