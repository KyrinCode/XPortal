// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract LightClient {
    
    struct BlockHeader {
        bytes32 blockHash;
        bytes32 stateRoot;
        bytes32 receiptRoot;
    }

    mapping (uint => BlockHeader) blockHeaders;

    // event BlockHash(bytes32);

    function validateBlockHeader(bytes32 blockHash, bytes calldata rlpBlockHeader) public pure returns (bool) {
        if (keccak256(rlpBlockHeader) == blockHash) {
            return true;
        } else {
            // emit BlockHash(keccak256(rlpBlockHeader));
            return false;
        }
    }
}