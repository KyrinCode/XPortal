const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
// const { Block } = require('@ethereumjs/block');
const { Trie } = require('@ethereumjs/trie');
const { toBuffer } = require('@ethereumjs/util')

const ethers = require('ethers');
const provider = require('./ganache/provider');
const { source, xPortal1, xPortal2, target } = require('./ganache/contracts');

function getRawReceipt(receipt) {
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
}

async function getReceiptProof(txHash) {
    const receipt = await web3.eth.getTransactionReceipt(txHash)
    if (!receipt) {
        throw new Error("txhash/receipt not found.")
    }
    const block = await web3.eth.getBlock(receipt.blockHash)
    // const rawHeader = Block.fromRPC(block).header;
    // const rawReceiptRoot = rawHeader.receiptTrie;
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

    const path = RLP.encode(receipt.transactionIndex)
    // console.log(path)

    const proof = {
        path: "0x" + Buffer.from(path).toString("hex"),
        rlpParentNodes: "0x" + Buffer.from(RLP.encode(stack.map(s => s.raw()))).toString("hex"), // witness
        blockNumber: receipt.blockNumber
    }
    return proof;
}

async function getStateProof(chainId, blockNumber, account, slots) {
    const stateProof = await web3.eth.getProof(account, slots, blockNumber);
    console.log("stateProof", stateProof);
    let accountProof = [];
    for (const rlpItem of stateProof.accountProof) {
        accountProof.push(RLP.decode(rlpItem));
    }
    const rlpAccountProof = "0x" + Buffer.from(RLP.encode(accountProof)).toString("hex");
    let rlpStorageProof = [];
    for (const slotProof of stateProof.storageProof) {
        let proof = []
        for (const rlpItem of slotProof.proof) {
            proof.push(RLP.decode(rlpItem));
        }
        const rlpSlotProof = "0x" + Buffer.from(RLP.encode(proof)).toString("hex");
        rlpStorageProof.push(rlpSlotProof);
    }
    return {
        rlpAccountProof: rlpAccountProof,
        rlpStorageProof: rlpStorageProof
    };
}

async function main() {
    let sendWaitingList = {};
    let callWaitingList = {};

    const signer = provider.getSigner();

    xPortal1.on("XSend", async (sourceContract, _targetChainId, targetContract, payload, event) => {
        console.log("XSend", event);
        const targetChainId = ethers.BigNumber.from(_targetChainId).toNumber();
        const proof = await getReceiptProof(event.transactionHash);

        const blockHash = await xPortal2.getBlockHash(1, event.blockNumber);
        console.log("block hash", blockHash);
        if (blockHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            if (sendWaitingList[event.blockNumber.toString()] == undefined) {
                sendWaitingList[event.blockNumber.toString()] = [];
            }
            // multi xSend share a common receipt proof
            let flag = false;
            for (const p of sendWaitingList[event.blockNumber.toString()]) {
                if (p.path == proof.path) {
                    flag = true;
                    break;
                }
            }
            if (!flag) {
                sendWaitingList[event.blockNumber.toString()].push(proof);
                console.log("push proof into send waiting list", proof);
            }
        } else {
            await xPortal2.connect(signer).xReceive(1, proof.path, proof.rlpParentNodes, event.blockNumber);

            const encodedPack = ethers.utils.solidityPack(["uint256", "uint256", "bytes"], [1, event.blockNumber, proof.path]);
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
    });

    xPortal2.on("XReceive", (key, targetContract, payload, event) => {
        console.log("XReceive", event);
        console.log("key", key);
    });

    xPortal2.on("SubmitBlockHeader", async (_chainId, _blockNumber, event) => {
        console.log("SubmitBlockHeader", event);
        const chainId = ethers.BigNumber.from(_chainId).toNumber()
        const blockNumber = ethers.BigNumber.from(_blockNumber).toNumber();

        for (const proof of sendWaitingList[blockNumber.toString()]) {
            await xPortal2.connect(signer).xReceive(chainId, proof.path, proof.rlpParentNodes, blockNumber);

            const encodedPack = ethers.utils.solidityPack(["uint256", "uint256", "bytes"], [chainId, blockNumber, proof.path]);
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
        delete sendWaitingList[blockNumber.toString()];
        console.log("send waiting list", sendWaitingList);
    });

    xPortal1.on("XCall", async (sourceContract, _targetChainId, _blockNumber, targetAccount, slots, event) => {
        console.log("XCall", event);
        const targetChainId = ethers.BigNumber.from(_targetChainId).toNumber();
        const blockNumber = ethers.BigNumber.from(_blockNumber).toNumber();
        let proof = await getStateProof(targetChainId, blockNumber, targetAccount, slots);

        const blockHash = await xPortal1.getBlockHash(targetChainId, blockNumber);
        console.log("block hash", blockHash);
        if (blockHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            if (callWaitingList[blockNumber.toString()] == undefined) {
                callWaitingList[blockNumber.toString()] = [];
            }
            proof.sourceContract = sourceContract;
            proof.targetChainId = targetChainId;
            proof.targetAccount = targetAccount;
            proof.slots = slots;
            callWaitingList[blockNumber.toString()].push(proof);
            console.log("push proof into call waiting list", proof);
        } else {
            await xPortal1.connect(signer).xResponse(sourceContract, targetChainId, blockNumber, targetAccount, proof.rlpAccountProof, slots, proof.rlpStorageProof);

            const encodedPack = ethers.utils.solidityPack(["address", "uint256", "uint256", "address", "bytes32[]"], [sourceContract, targetChainId, blockNumber, targetAccount, slots]);
            const key = ethers.utils.solidityKeccak256(["bytes"], [encodedPack]);
            console.log("key", key);

            const nonce = await source.nonce();
            const balance = await source.balance();
            const storageHash = await source.storageHash();
            const codeHash = await source.codeHash();
            console.log(nonce);
            console.log(balance);
            console.log(storageHash);
            console.log(codeHash);
            const slotValue0 = await source.slotValues(0);
            console.log(slotValue0);
            const slotValue1 = await source.slotValues(1);
            console.log(slotValue1);
        }

    });

    xPortal1.on("XResponse", (key, sourceContract, event) => {
        console.log("XResponse", event);
        console.log("key", key);
    });

    xPortal1.on("SubmitBlockHeader", async (_chainId, _blockNumber, event) => {
        console.log("SubmitBlockHeader", event);
        const chainId = ethers.BigNumber.from(_chainId).toNumber();
        const blockNumber = ethers.BigNumber.from(_blockNumber).toNumber();

        for (const proof of callWaitingList[blockNumber.toString()]) {
            await xPortal1.connect(signer).xResponse(proof.sourceContract, proof.targetChainId, blockNumber, proof.targetAccount, proof.rlpAccountProof, proof.slots, proof.rlpStorageProof);

            const encodedPack = ethers.utils.solidityPack(["address", "uint256", "uint256", "address", "bytes32[]"], [proof.sourceContract, proof.targetChainId, blockNumber, proof.targetAccount, proof.slots]);
            const key = ethers.utils.solidityKeccak256(["bytes"], [encodedPack]);
            console.log("key", key);

            const nonce = await source.nonce();
            const balance = await source.balance();
            const storageHash = await source.storageHash();
            const codeHash = await source.codeHash();
            console.log(nonce);
            console.log(balance);
            console.log(storageHash);
            console.log(codeHash);
            const slotValue0 = await source.slotValues(0);
            console.log(slotValue0);
            const slotValue1 = await source.slotValues(1);
            console.log(slotValue1);
        }
        delete callWaitingList[blockNumber.toString()];
        console.log("call waiting list", callWaitingList);
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});