// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

interface IXPortal {
    function xSend(uint, address, bytes calldata) external;
    function xCall(uint, uint, address, bytes32[] calldata) external;
}

contract Source {
    address public xPortal;
    address public targetContract;

    uint public nonce;
    uint public balance;
    bytes32 public storageHash;
    bytes32 public codeHash;
    bytes32[] public slotValues;

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
        uint blockNumber = 13;
        // address targetAccount = 0xC02a1889E6c59aA1a71Cfe3142C97Db21a7B63Ef;
        address targetAccount = 0xd1Dbd00824D5c3D2eBb4DC597FF102595AF9576a;
        bytes32[] memory slots = new bytes32[](2);
        slots[0] = 0x0;
        slots[1] = 0x0000000000000000000000000000000000000000000000000000000000000001;

        IXPortal(xPortal).xCall(chainId, blockNumber, targetAccount, slots);
    }

    fallback(bytes calldata input) external returns (bytes memory output) {
        require(msg.sender == xPortal);
        (nonce, balance, storageHash, codeHash, slotValues) = abi.decode(input[4:], (uint256, uint256, bytes32, bytes32, bytes32[]));
    }

    receive() external payable {}
}