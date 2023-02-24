// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface IXPortal {
    function xSend(uint, address, bytes calldata) external;
    function xCall(uint, uint, address) external;
}

contract Source {
    address public xPortal;
    address public targetContract;

    function updateXPortal(address _xPortal) public {
        xPortal = _xPortal;
    }

    function updateTargetContract(address _targetContract) public {
        targetContract = _targetContract;
    }

    // func: receive0(uint256,string); payload: 5,"text" 
    // -> funcSig: bytes4(keccak256(bytes("receive0(uint256,string)"))) -> 0x4c8f7848; payload: abi.encodeWithSelector(funcSig, 5, "text")
    // -> receipt data  0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000844c8f7848000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004746578740000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
    // -> abi.decode(bytes) 0x4c8f78480000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000047465787400000000000000000000000000000000000000000000000000000000
    function send1() public { // bytes calldata payload
        uint chainId = 2;
        string memory func = "receive1(uint256,string)";
        bytes4 funcSig = bytes4(keccak256(bytes(func)));
       
        uint val = 5;
        string memory s = "text";
        bytes memory payload = abi.encodeWithSelector(funcSig, val, s);

        IXPortal(xPortal).xSend(chainId, targetContract, payload);
    }

    function send2() public { // bytes calldata payload
        uint chainId = 2;
        string memory func = "receive2(string,bytes)";
        bytes4 funcSig = bytes4(keccak256(bytes(func)));
       
        string memory s = "text1";
        bytes memory b = hex"31415926";
        bytes memory payload = abi.encodeWithSelector(funcSig, s, b);

        IXPortal(xPortal).xSend(chainId, targetContract, payload);
    }

    function send() public {
        send1();
        send2();
    }

    function call1() public {
        uint chainId = 2;
        uint blockNumber = 799;
        address targetAccount = 0x11D6A1e4704d91f97dD8A96FB988641B504DBAc4;

        IXPortal(xPortal).xCall(chainId, blockNumber, targetAccount);
    }
}