const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const { Block } = require('@ethereumjs/block');
const { toBuffer, toHex } = require('@ethereumjs/util');
// const { keccak256 } = require("ethereum-cryptography/keccak");
const { Trie } = require('@ethereumjs/trie');
const Receipt = require('./receipt');

const provider = require('./ganache/provider')
const {source, xPortal2, target} = require('./ganache/contracts')

async function getReceiptProof(txHash) {
    // receipt from rpc, block, web3, receipts
    const receipt = await web3.eth.getTransactionReceipt(txHash)
    console.log(receipt)
    if (!receipt) {
        throw new Error("txhash/receipt not found.")
    }
    // block from rpc
    const block = await web3.eth.getBlock(receipt.blockHash)
    console.log('block', block)
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

    let { node, remaining, stack } = await receiptsTrie.findPath(RLP.encode(receipt.transactionIndex))
    // console.log('node', node)
    // console.log('remaining', remaining)
    // console.log('stack', stack)

    // the path is HP encoded
    const key = RLP.encode(receipt.transactionIndex)
    // const key = RLP.encode(1023)
    console.log(key)
    let hpKey = new Uint8Array(key.length + 1);
    hpKey[0] = 32
    hpKey.set(key, 1);
    console.log(hpKey)

    // console.log('node', node.value())
    // console.log('value', stack.map(s => s.raw())[stack.length - 1][1])

    const proof = { // value encodePath rlpParentNodes root
        value: "0x" + node.value().toString("hex"), // rlpEncodedReceipt
        encodePath: hpKey,
        parentNodes: RLP.encode(stack.map(s => s.raw())), // witness
        root: block.receiptsRoot // rawReceiptRoot,
    }
    return proof;
}

async function main() {
    const signer = provider.getSigner();
    console.log(signer)
    const tx1 = await source.connect(signer).send1();
    // console.log(tx1);
    const receipt1 = await tx1.wait();
    console.log("source receipt", receipt1);
    const txHash = tx1.hash;
    console.log("txHash", tx1.hash);
    const proof = await getReceiptProof(txHash);
    console.log(proof);
    
    const tx2 = await xPortal2.connect(signer).xReceive(proof.value, proof.encodePath, proof.parentNodes, proof.root);
    const receipt2 = await tx2.wait();
    console.log("xPortal2 receipt", receipt2);
}

main();