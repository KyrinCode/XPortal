// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./MerklePatriciaProof.sol";
import "./RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract LightClient {
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
        RLPReader.RLPItem[] memory blockHeader = RLPReader.toList(RLPReader.toRlpItem(rlpBlockHeader));
        bh.blockHash = blockHash;
        bh.stateRoot = bytes32(RLPReader.toBytes(blockHeader[3]));
        bh.receiptRoot = bytes32(RLPReader.toBytes(blockHeader[5]));
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

    function verifyReceiptProof(
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        uint blockNumber
    ) external view returns (bool) {
        bytes32 receiptRoot = getReceiptRootByBlockHeader(blockNumber);
        bool success = MerklePatriciaProof.verify(
            value,
            encodedPath,
            rlpParentNodes,
            receiptRoot
        );
        return success;
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
