// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "./MerklePatriciaProof.sol";
import "./RLPReader.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract LightClient {
    address xPortal;
    struct BlockHeader {
        bool exist;
        bytes32 stateRoot;
        bytes32 receiptRoot;
    }

    mapping(bytes32 => BlockHeader) public blockHeaders;

    constructor(address _xPortal) {
        xPortal = _xPortal;
    }

    modifier onlyXPortal() {
        require(msg.sender == xPortal);
        _;
    }

    function submitBlockHeader(
        bytes32 blockHash,
        bytes calldata rlpBlockHeader
    ) external onlyXPortal {
        BlockHeader memory bh;
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(rlpBlockHeader);
        RLPReader.RLPItem[] memory blockHeader = RLPReader.toList(item);
        bh.exist = true;
        bh.stateRoot = bytes32(RLPReader.toBytes(blockHeader[3]));
        bh.receiptRoot = bytes32(RLPReader.toBytes(blockHeader[5]));
        blockHeaders[blockHash] = bh;
    }

    function hasBlockHeader(
        bytes32 blockHash
    ) public view returns (bool) {
        if (blockHeaders[blockHash].exist) {
            return true;
        } else {
            return false;
        }
    }

    function getStateRootByBlockHeader(
        bytes32 blockHash
    ) public view returns (bytes32) {
        return blockHeaders[blockHash].stateRoot;
    }

    function getReceiptRootByBlockHeader(
        bytes32 blockHash
    ) public view returns (bytes32) {
        return blockHeaders[blockHash].receiptRoot;
    }

    function verifyReceiptProof(
        bytes calldata value,
        bytes calldata encodedPath,
        bytes calldata rlpParentNodes,
        bytes32 blockHash
    ) external view returns (bool) {
        bytes32 receiptRoot = getReceiptRootByBlockHeader(blockHash);
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
