// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Target {
    uint public val0;
    string public s0;

    string public s1;
    bytes public b1;

    function receive0(uint _val, string calldata _s) public {
        val0 = _val;
        s0 = _s;
    }

    function receive1(string calldata _s, bytes calldata _b) public {
        s1 = _s;
        b1 = _b;
    }
}