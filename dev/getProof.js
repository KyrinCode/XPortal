const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const { Block } = require('@ethereumjs/block');
const { toBuffer, toHex } = require('@ethereumjs/util');
const { keccak256 } = require("ethereum-cryptography/keccak");
const { Trie } = require('@ethereumjs/trie');
// const Header = require('./header');
// const Proof = require('./proof');
const Receipt = require('./receipt');

const provider = require('./ganache/provider')
const merklePatriciaProof = require('./merklePatriciaProof')

async function getReceiptProof(txHash) {
    // receipt from rpc, block, web3, receipts
    const targetReceipt = await web3.eth.getTransactionReceipt(txHash)
    console.log(targetReceipt)
    if (!targetReceipt) {
        throw new Error("txhash/targetReceipt not found.")
    }
    // block from rpc
    const block = await web3.eth.getBlock(targetReceipt.blockHash)
    // console.log('block', block)
    const rawHeader = Block.fromRPC(block).header;
    // raw receipt root
    const rawReceiptRoot = rawHeader.receiptTrie;
    console.log("Block receipt root", rawReceiptRoot)
    // receipts from rpc
    const receipts = await Promise.all(block.transactions.map((siblingTxHash) => {
        return web3.eth.getTransactionReceipt(siblingTxHash)
    }))

    // trie put
    const receiptsTrie = new Trie();
    for (let i = 0; i < receipts.length; i++) {
        const siblingReceipt = receipts[i];
        const path = RLP.encode(siblingReceipt.transactionIndex)
        const rawReceipt = Receipt.fromRpc(siblingReceipt).serialize()
        // console.log('path', path)
        // console.log('rawReceipt', rawReceipt)
        await receiptsTrie.put(path, rawReceipt)
    }

    // trie receipt root
    console.log("Trie receipt root", receiptsTrie.root())
    // console.log("receiptsTrie", receiptsTrie)

    let { node, remaining, stack } = await receiptsTrie.findPath(RLP.encode(targetReceipt.transactionIndex))
    // console.log('node', node)
    // console.log('remaining', remaining)
    // console.log('stack', stack)

    // const proof = await receiptsTrie.createProof(RLP.encode(targetReceipt.transactionIndex));
    // console.log('proof', proof)

    // the path is HP encoded
    const key = RLP.encode(targetReceipt.transactionIndex)
    // const key = RLP.encode(1023)
    console.log(key)
    let hpKey = new Uint8Array(key.length + 1);
    hpKey[0] = 32
    hpKey.set(key, 1);
    console.log(hpKey)
    // const indexBuffer = tmp.slice(2);
    // console.log(indexBuffer)
    // const hpIndex = "0x" + (indexBuffer.startsWith("0") ? "1" + indexBuffer.slice(1) : "00" + indexBuffer);
    // console.log(hpIndex)

    // console.log('node', node.value())
    // console.log('value', stack.map(s => s.raw())[stack.length - 1][1])

    const prf = { // value encodePath rlpParentNodes root
        value: "0x" + node.value().toString("hex"), // rlpEncodedReceipt
        encodePath: hpKey,
        parentNodes: RLP.encode(stack.map(s => s.raw())), // witness
        root: block.receiptsRoot // rawReceiptRoot,

        // blockHash: toBuffer(targetReceipt.blockHash)
    }
    // console.log(prf);
    return prf;
}

// function verifyProof(proof) {
//     const path = proof.path.toString('hex')
//     const value = proof.value
//     const parentNodes = proof.parentNodes
//     const txRoot = proof.root
//     try {
//         var currentNode
//         var len = parentNodes.length
//         var nodeKey = txRoot
//         var pathPtr = 0
//         for (var i = 0; i < len; i++) {
//             currentNode = parentNodes[i]
//             const encodedNode = Buffer.from(
//                 keccak256(RLP.encode(currentNode)),
//                 'hex'
//             )
//             if (!nodeKey.equals(encodedNode)) {
//                 return false
//             }
//             if (pathPtr > path.length) {
//                 return false
//             }
//             switch (currentNode.length) {
//                 case 17: // branch node
//                     if (pathPtr === path.length) {
//                         if (currentNode[16] === keccak256(value)) {
//                             return true
//                         } else {
//                             return false
//                         }
//                     }
//                     nodeKey = currentNode[parseInt(path[pathPtr], 16)] // must === sha3(RLP.encode(currentNode[path[pathptr]]))
//                     pathPtr += 1
//                     break
//                 case 2:
//                     pathPtr += nibblesToTraverse(
//                         currentNode[0].toString('hex'),
//                         path,
//                         pathPtr
//                     )
//                     if (pathPtr === path.length) {
//                         // leaf node
//                         if (currentNode[1].equals(RLP.encode(value))) {
//                             return true
//                         } else {
//                             return false
//                         }
//                     } else {
//                         // extension node
//                         nodeKey = currentNode[1]
//                     }
//                     break
//                 default:
//                     console.log('all nodes must be length 17 or 2')
//                     return false
//             }
//         }
//     } catch (e) {
//         console.log(e)
//         return false
//     }
//     return false
// }

async function main() {
    // const contractAddress = "0xd94A1D882E6c7Dd92b76613321a925Aa78a79145";
    // const slotIndex = 0;

    // // web3.eth.getProof(contractAddress, [slotIndex], (error, proof) => {
    // //   if (error) {
    // //     console.error(error);
    // //   } else {
    // //     console.log(proof);
    // //   }
    // // });

    // const proof = await web3.eth.getProof(contractAddress, [slotIndex]);
    // console.log(proof);
    const txHash = '0xde9c61158f31bee47184362369abdd19f68ae6a699d7bfaf84f393460e48d695';
    const proof = await getReceiptProof(txHash);
    console.log(proof);
    
    // const signer = provider.getSigner();
    // console.log(signer)
    const success = await merklePatriciaProof.verify(proof.value, proof.encodePath, proof.parentNodes, proof.root);
    console.log(success)

}

main();

