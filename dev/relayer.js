const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const { Block } = require('@ethereumjs/block');
const { Trie } = require('@ethereumjs/trie');
const Receipt = require('./receipt');

const ethers = require('ethers');
const provider = require('./ganache/provider');
const { xPortal1, xPortal2, target } = require('./ganache/contracts');
const { boolean } = require('hardhat/internal/core/params/argumentTypes');

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
        const path = RLP.encode(siblingReceipt.transactionIndex)
        const rawReceipt = Receipt.fromRpc(siblingReceipt).serialize() // todo: extract useful part
        await receiptsTrie.put(path, rawReceipt)
    }

    // trie receipt root
    // console.log("Trie receipt root", receiptsTrie.root())

    let { node, remaining, stack } = await receiptsTrie.findPath(RLP.encode(receipt.transactionIndex))

    // the path is HP encoded
    const key = RLP.encode(receipt.transactionIndex)
    // console.log(key)
    let hpKey = new Uint8Array(key.length + 1);
    hpKey[0] = 32
    hpKey.set(key, 1);
    // console.log(hpKey)

    const proof = {
        value: "0x" + node.value().toString("hex"), // rlpEncodedReceipt, where node.value() equals to stack.map(s => s.raw())[stack.length - 1][1]
        encodePath: hpKey,
        rlpParentNodes: RLP.encode(stack.map(s => s.raw())), // witness
        blockHash: receipt.blockHash
    }
    return proof;
}

async function main() {
    let waitingList1 = {};

    const signer = provider.getSigner();

    xPortal1.on("XSend", async (targetChainId, targetContract, payload, event) => {
        console.log("XSend", event);
        const proof = await getReceiptProof(event.transactionHash);
        switch (targetChainId) {
            case 2:
                const receiptRoot = await xPortal2.getReceiptRootByBlockHeader(1, proof.blockHash);
                console.log("receipt root", receiptRoot);
                if (receiptRoot == "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    if (waitingList1[proof.blockHash] == undefined) {
                        waitingList1[proof.blockHash] = [];
                    }
                    let flag = false;
                    for (const p of waitingList1[proof.blockHash]) {
                        if (JSON.stringify(p.encodePath) == JSON.stringify(proof.encodePath)) {
                            flag = true;
                            break;
                        }
                    }
                    if (!flag) {
                        waitingList1[proof.blockHash].push(proof);
                        console.log("push proof into waiting list 1", proof);
                    }
                } else {
                    await xPortal2.connect(signer).xReceive(1, proof.value, proof.encodePath, proof.rlpParentNodes, proof.blockHash);
                    const encodedPack = ethers.utils.solidityPack(["uint8", "bytes32", "bytes"], [1, proof.blockHash, proof.encodePath]);
                    const key = ethers.utils.solidityKeccak256(["bytes"], [encodedPack]);
                    console.log("key", key);
                    const val1 = await target.val1();
                    const s1 = await target.s1();
                    const s2 = await target.s2();
                    const b2 = await target.b2();
                    console.log(val1);
                    console.log(s1);
                    console.log(s2);
                    console.log(b2);
                }
                break;

            default:
                break;
        }
    });

    xPortal2.on("XReceive", (key, event) => {
        console.log("XReceive", event);
        console.log("key", key);
    });

    xPortal2.on("SubmitBlockHeader", async (chainId, blockHash, event) => {
        console.log("SubmitBlockHeader", event);
        switch (chainId) {
            case 1:
                for (const proof of waitingList1[blockHash]) {
                    await xPortal2.connect(signer).xReceive(1, proof.value, proof.encodePath, proof.rlpParentNodes, proof.blockHash);
                    const encodedPack = ethers.utils.solidityPack(["uint8", "bytes32", "bytes"], [1, proof.blockHash, proof.encodePath]);
                    const key = ethers.utils.solidityKeccak256(["bytes"], [encodedPack]);
                    console.log("key", key);
                    const val1 = await target.val1();
                    const s1 = await target.s1();
                    const s2 = await target.s2();
                    const b2 = await target.b2();
                    console.log(val1);
                    console.log(s1);
                    console.log(s2);
                    console.log(b2);
                }
                delete waitingList1[blockHash];
                console.log("waiting list 1", waitingList1);
                break;

            default:
                break;
        }
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});