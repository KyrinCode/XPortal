const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const { Block } = require('@ethereumjs/block');
const { Trie } = require('@ethereumjs/trie');
const { toBuffer } = require('@ethereumjs/util')
// const Receipt = require('./receipt');

const provider = require('./ganache/provider')
const { source, xPortal2, target } = require('./ganache/contracts')

function getRawReceipt(receipt) {
    // const rawReceipt = Receipt.fromRpc(receipt).serialize();

    const logs = receipt.logs.map(l => {
        // [address, [topics array], data]
        return [
            toBuffer(l.address), // convert address to buffer
            l.topics.map(toBuffer), // convert topics to buffer
            toBuffer(l.data) // convert data to buffer
        ]
    })
    let data = [
        toBuffer(
            // receipt.status ? 1 : 0
            receipt.status !== undefined && receipt.status != null
                ? receipt.status
                    ? 1
                    : 0
                : receipt.root
        ),
        toBuffer(receipt.cumulativeGasUsed),
        toBuffer(receipt.logsBloom),
        logs
    ];
    if (receipt.type) {
        return Buffer.concat([toBuffer(receipt.type), RLP.encode(data)]);
    } else {
        return RLP.encode(data);
    }
    // return rawReceipt;
}

async function getReceiptProof(txHash) {
    const receipt = await web3.eth.getTransactionReceipt(txHash)
    if (!receipt) {
        throw new Error("txhash/receipt not found.")
    }
    const block = await web3.eth.getBlock(receipt.blockHash)
    const rawHeader = Block.fromRPC(block).header;
    const rawReceiptRoot = rawHeader.receiptTrie;
    // console.log("Block receipt root", rawReceiptRoot)
    const receipts = await Promise.all(block.transactions.map((siblingTxHash) => {
        return web3.eth.getTransactionReceipt(siblingTxHash)
    }))

    // trie put
    const receiptsTrie = new Trie();
    for (let i = 0; i < receipts.length; i++) {
        const siblingReceipt = receipts[i];
        const path = RLP.encode(siblingReceipt.transactionIndex);
        const rawReceipt = getRawReceipt(siblingReceipt);
        await receiptsTrie.put(path, rawReceipt);
    }

    // trie receipt root
    // console.log("Trie receipt root", receiptsTrie.root())

    let { node, remaining, stack } = await receiptsTrie.findPath(RLP.encode(receipt.transactionIndex))

    // the path is HP encoded
    const key = RLP.encode(receipt.transactionIndex)
    // console.log(key)
    let mptKey = new Uint8Array(key.length * 2);
    for (let i = 0; i < key.length; i++) {
        mptKey[i] = key[i] >> 4;
        mptKey[i+1] = key[i] & 0xF;
    }
    console.log("mptKey", mptKey);

    let hpKey = new Uint8Array(key.length + 1);
    hpKey[0] = 32
    hpKey.set(key, 1);
    // console.log(hpKey)

    const proof = {
        // value: "0x" + node.value().toString("hex"), // rlpEncodedReceipt, where node.value() equals to stack.map(s => s.raw())[stack.length - 1][1]
        key: "0x" + Buffer.from(key).toString("hex"),
        // mptKey: "0x" + Buffer.from(mptKey).toString("hex"),
        // encodePath: "0x" + Buffer.from(hpKey).toString("hex"),
        rlpParentNodes: "0x" + Buffer.from(RLP.encode(stack.map(s => s.raw()))).toString("hex"), // witness
        blockNumber: receipt.blockNumber
    }
    return proof;
}

async function getRlpBlockHeader(blockNumber) {
    const block = await web3.eth.getBlock(blockNumber)
    // console.log('block', block);
    let data = [
        block.parentHash,
        block.sha3Uncles,
        block.miner,
        block.stateRoot,
        block.transactionsRoot,
        block.receiptsRoot,
        block.logsBloom,
        block.difficulty == '0' ? '0x' : web3.utils.toHex(block.difficulty),
        block.number == 0 ? '0x' : web3.utils.toHex(block.number),
        web3.utils.toHex(block.gasLimit),
        block.gasUsed == 0 ? '0x' : web3.utils.toHex(block.gasUsed),
        web3.utils.toHex(block.timestamp),
        block.extraData,
        block.mixHash,
        block.nonce,
        web3.utils.toHex(block.baseFeePerGas)
    ]
    // console.log(data)
    const rlpBlockHeader = "0x" + Buffer.from(RLP.encode(data)).toString("hex");
    return {
        rlpBlockHeader: rlpBlockHeader
    };
}

async function main() {
    const signer = provider.getSigner();
    const tx1 = await source.connect(signer).send();
    // console.log(tx1);
    const receipt1 = await tx1.wait();
    console.log("source receipt", receipt1);

    // submit block header
    const { rlpBlockHeader } = await getRlpBlockHeader(tx1.blockNumber);
    console.log("rlpBlockHeader", rlpBlockHeader);
    await xPortal2.connect(signer).submitBlockHeader(1, tx1.blockNumber, rlpBlockHeader);

    // message passing
    console.log("txHash", tx1.hash);
    const proof = await getReceiptProof(tx1.hash);
    console.log(proof);
    const sourceChainId = 1;
    const tx2 = await xPortal2.connect(signer).xReceive(sourceChainId, proof.key, proof.rlpParentNodes, proof.blockNumber);
    const receipt2 = await tx2.wait();
    console.log("xPortal2 receipt", receipt2);

    const val1 = await target.val1();
    const s1 = await target.s1();
    const s2 = await target.s2();
    const b2 = await target.b2();
    console.log(val1);
    console.log(s1);
    console.log(s2);
    console.log(b2);
}

main();