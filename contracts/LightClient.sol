// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./lib/MerklePatriciaProof.sol";
import "./lib/RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract LightClient {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    address xPortal;
    struct BlockHeader {
        bytes32 blockHash;
        bytes32 stateRoot;
        bytes32 receiptRoot;
    }

    mapping(uint => BlockHeader) public blockHeaders;

    constructor(address _xPortal) {
        xPortal = _xPortal;
    }

    modifier onlyXPortal() {
        require(msg.sender == xPortal);
        _;
    }

    function submitBlockHeader(
        uint blockNumber,
        bytes calldata rlpBlockHeader
    ) external onlyXPortal {
        bytes32 blockHash = keccak256(rlpBlockHeader);
        BlockHeader memory bh;
        RLPReader.RLPItem[] memory blockHeader = rlpBlockHeader.toRlpItem().toList();
        bh.blockHash = blockHash;
        bh.stateRoot = bytes32(blockHeader[3].toBytes());
        bh.receiptRoot = bytes32(blockHeader[5].toBytes());
        blockHeaders[blockNumber] = bh;
    }

    function hasBlockHeader(
        uint blockNumber
    ) public view returns (bool) {
        if (blockHeaders[blockNumber].blockHash != 0x0000000000000000000000000000000000000000000000000000000000000000) {
            return true;
        } else {
            return false;
        }
    }

    function getStateRootByBlockHeader(
        uint blockNumber
    ) public view returns (bytes32) {
        return blockHeaders[blockNumber].stateRoot;
    }

    function getReceiptRootByBlockHeader(
        uint blockNumber
    ) public view returns (bytes32) {
        return blockHeaders[blockNumber].receiptRoot;
    }

    function extractReceiptFromProof(
        bytes calldata path,
        bytes calldata rlpParentNodes,
        uint blockNumber
    ) external view returns (bytes memory) {
        bytes32 receiptRoot = getReceiptRootByBlockHeader(blockNumber);
        bytes memory receipt = MerklePatriciaProof.verify(
            path,
            rlpParentNodes,
            receiptRoot
        );
        return receipt;
    }

    function extractAccountFromProof(
        bytes calldata path,
        bytes calldata rlpParentNodes,
        uint blockNumber
    ) external view returns (bytes memory) {
        bytes32 stateRoot = getStateRootByBlockHeader(blockNumber);
        bytes memory account = MerklePatriciaProof.verify(
            path,
            rlpParentNodes,
            stateRoot
        );
        return account;
    }

    // test
    function validateBlockHeader(
        bytes32 blockHash,
        bytes calldata rlpBlockHeader
    ) external pure returns (bool) {
        if (keccak256(rlpBlockHeader) == blockHash) {
            return true;
        } else {
            return false;
        }
    }
}
