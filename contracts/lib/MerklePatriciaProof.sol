// SPDX-License-Identifier: Apache-2.0

// https://github.com/KyberNetwork/peace-relay/blob/master/contracts/MerklePatriciaProof.sol
// https://github.com/PISAresearch/event-proofs/blob/master/contracts/PatriciaTree.sol
// https://github.com/lorenzb/proveth/blob/master/onchain/ProvethVerifier.sol

/*
 * @title MerklePatriciaVerifier
 * @author Sam Mayo (sammayo888@gmail.com)
 *
 * @dev Library for verifing merkle patricia proofs.
 */
pragma solidity >=0.5.11 <=0.8.18;
import "./RLPReader.sol";

library MerklePatriciaProof {
    /*
     * @dev Verifies a merkle patricia proof.
     * @param encodedPath The path in the trie leading to value.
     * @param rlpParentNodes The rlp encoded stack of nodes.
     * @param root The root hash of the trie.
     * @return value The terminating value in the trie.
     */
    function verify(
        bytes memory _path,
        bytes memory rlpParentNodes,
        bytes32 root
    ) internal pure returns (bytes memory value) {
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(rlpParentNodes);
        RLPReader.RLPItem[] memory parentNodes = RLPReader.toList(item);

        bytes memory currentNode;
        RLPReader.RLPItem[] memory currentNodeList;

        bytes32 nodeKey = root;
        uint pathPtr = 0;

        bytes memory path = _decodeNibbles(_path, 0);
        // bytes memory path = _getNibbleArray(encodedPath); // 0x0800 if index == 0
        if (path.length == 0) {
            revert();
        }

        if (parentNodes.length == 0) {
            // Root hash of empty Merkle-Patricia-Trie
            require(
                root ==
                    0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421
            );
            return new bytes(0);
        }

        for (uint i = 0; i < parentNodes.length; i++) {
            if (pathPtr > path.length) {
                revert();
            }

            currentNode = RLPReader.toRlpBytes(parentNodes[i]);
            if (nodeKey != keccak256(currentNode)) {
                revert();
            }
            currentNodeList = RLPReader.toList(parentNodes[i]);

            if (currentNodeList.length == 17) {
                if (pathPtr == path.length) {
                    return RLPReader.toBytes(currentNodeList[16]);
                }

                uint8 nextPathNibble = uint8(path[pathPtr]);
                if (nextPathNibble > 16) {
                    revert();
                }
                nodeKey = bytes32(
                    RLPReader.toUint(currentNodeList[nextPathNibble])
                );
                pathPtr += 1;
            } else if (currentNodeList.length == 2) {
                pathPtr += _nibblesToTraverse(
                    RLPReader.toBytes(currentNodeList[0]),
                    path,
                    pathPtr
                );

                if (pathPtr == path.length) {
                    //leaf node
                    return RLPReader.toBytes(currentNodeList[1]);
                }
                //extension node
                if (
                    _nibblesToTraverse(
                        RLPReader.toBytes(currentNodeList[0]),
                        path,
                        pathPtr
                    ) == 0
                ) {
                    revert();
                }

                nodeKey = bytes32(RLPReader.toUint(currentNodeList[1]));
            } else {
                revert();
            }
        }
    }

    function _decodeNibbles(bytes memory compact, uint skipNibbles) internal pure returns (bytes memory nibbles) {
        require(compact.length > 0);

        uint length = compact.length * 2;
        require(skipNibbles <= length);
        length -= skipNibbles;

        nibbles = new bytes(length);
        uint nibblesLength = 0;

        for (uint i = skipNibbles; i < skipNibbles + length; i += 1) {
            if (i % 2 == 0) {
                nibbles[nibblesLength] = bytes1((uint8(compact[i/2]) >> 4) & 0xF);
            } else {
                nibbles[nibblesLength] = bytes1((uint8(compact[i/2]) >> 0) & 0xF);
            }
            nibblesLength += 1;
        }

        assert(nibblesLength == nibbles.length);
    }

    function _nibblesToTraverse(
        bytes memory encodedPartialPath,
        bytes memory path,
        uint pathPtr
    ) private pure returns (uint) {
        uint len;
        // encodedPartialPath has elements that are each two hex characters (1 byte), but partialPath
        // and slicedPath have elements that are each one hex character (1 nibble)
        bytes memory partialPath = _getNibbleArray(encodedPartialPath);
        bytes memory slicedPath = new bytes(partialPath.length);

        // pathPtr counts nibbles in path
        // partialPath.length is a number of nibbles
        for (uint i = pathPtr; i < pathPtr + partialPath.length; i++) {
            bytes1 pathNibble = path[i];
            slicedPath[i - pathPtr] = pathNibble;
        }

        if (keccak256(partialPath) == keccak256(slicedPath)) {
            len = partialPath.length;
        } else {
            len = 0;
        }
        return len;
    }

    // bytes b must be hp encoded
    function _getNibbleArray(
        bytes memory b
    ) private pure returns (bytes memory) {
        bytes memory nibbles;
        if (b.length > 0) {
            uint8 offset;
            uint8 hpNibble = uint8(_getNthNibbleOfBytes(0, b));
            if (hpNibble == 1 || hpNibble == 3) {
                nibbles = new bytes(b.length * 2 - 1);
                bytes1 oddNibble = _getNthNibbleOfBytes(1, b);
                nibbles[0] = oddNibble;
                offset = 1;
            } else {
                nibbles = new bytes(b.length * 2 - 2);
                offset = 0;
            }

            for (uint i = offset; i < nibbles.length; i++) {
                nibbles[i] = _getNthNibbleOfBytes(i - offset + 2, b);
            }
        }
        return nibbles;
    }

    /*
     *This function takes in the bytes string (hp encoded) and the value of N, to return Nth Nibble.
     *@param Value of N
     *@param Bytes String
     *@return ByteString[N]
     */
    function _getNthNibbleOfBytes(
        uint n,
        bytes memory str
    ) private pure returns (bytes1) {
        return
            bytes1(
                n % 2 == 0 ? uint8(str[n / 2]) / 0x10 : uint8(str[n / 2]) % 0x10
            );
    }
}
