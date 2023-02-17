// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface IEndpoint {
    function xSend(uint, address, bytes4, bytes calldata) external;
}

contract Source {
    address public endpoint;
    address public targetInterpreter;

    function updateEndpoint(address _endpoint) public {
        endpoint = _endpoint;
    }

    function updateTargetInterpreter(address _targetInterpreter) public {
        targetInterpreter = _targetInterpreter;
    }

    // original func: test(uint,string); original payload: 5,"text" 
    // -> funcSig: bytes4(keccak256(bytes("test(bytes)"))) -> 0x2f570a23; payload: rlpPrepared ["0x05","0x74657874"] -> rlpEncoded 0xc6058474657874
    // -> receipt data 0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000007c605847465787400000000000000000000000000000000000000000000000000
    // 
    // -> abiDecoded bytes 0xc6058474657874 -> rlpDecoded ["0x05","0x74657874"] -> toUint 5, string(toBytes) "text" 
    function send0() public { // bytes calldata payload
        uint chainId = 1;
        string memory func = "receive0(bytes)"; // Interpreter: "receive0(bytes)", Original: "test(uint,string)"
        bytes4 funcSig = bytes4(keccak256(bytes(func)));
       
        uint val = 5;
        string memory s = "text";
        bytes memory payload = abi.encode(val, s);

        IEndpoint(endpoint).xSend(chainId, targetInterpreter, funcSig, payload);
    }

    function send1() public { // bytes calldata payload
        uint chainId = 1;
        string memory func = "receive1(bytes)"; // Interpreter: "receive1(bytes)", Original: "test1(string,bytes)"
        bytes4 funcSig = bytes4(keccak256(bytes(func)));
       
        string memory s = "text1";
        bytes memory b = hex"31415926";
        bytes memory payload = abi.encode(s, b);

        IEndpoint(endpoint).xSend(chainId, targetInterpreter, funcSig, payload);
    }
}