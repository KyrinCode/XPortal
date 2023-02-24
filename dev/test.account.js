const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const { Block } = require('@ethereumjs/block');
const { Trie } = require('@ethereumjs/trie');
const Receipt = require('./receipt');

const provider = require('./ganache/provider')
const { source, xPortal1, xPortal2, target } = require('./ganache/contracts')

async function getQueriesFromReceipt(txHash) {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
        throw new Error("txhash/receipt not found.")
    }
    // console.log(receipt.logs);
    // filter contract address and eventSig
    let queries = [];
    for (const log of receipt.logs) {
        if (log.address == xPortal1.address && log.topics[0] == "0xaa31d73d2ab91eb37f4617f921d2f3bd94a7766aa1218da58268c6b1774bd525") {
            let query = {}
            query["sourceContract"] = web3.eth.abi.decodeParameter('address', log.topics[1]);
            query["targetChainId"] = web3.eth.abi.decodeParameter('uint', log.topics[2]);
            query["blockNumber"] = web3.eth.abi.decodeParameter('uint', log.topics[3]);
            query["targetAccount"] = web3.eth.abi.decodeParameter('address', log.data);
            queries.push(query);
        }
    }
    return queries;
}

async function getStateProof(chainId, blockNumber, account) {
    const slotIndex = 0;
    const stateProof = await web3.eth.getProof(account, [slotIndex, 1], blockNumber);
    console.log("stateProof", stateProof);
    const accountProof = [];
    for (const rlpItem of stateProof.accountProof) {
        accountProof.push(RLP.decode(rlpItem));
    }
    const rlpAccountProof = "0x" + Buffer.from(RLP.encode(accountProof)).toString("hex");
    return rlpAccountProof;
}

async function getBlockHeader(blockNumber) {
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
    const tx1 = await source.connect(signer).call1();
    // console.log(tx1);
    const receipt1 = await tx1.wait();
    console.log("xCall receipt", receipt1);

    // queries
    console.log("txHash", tx1.hash);
    const queries = await getQueriesFromReceipt(tx1.hash);
    console.log("queries", queries);

    for (let query of queries) {
        // submit block header
        const { rlpBlockHeader } = await getBlockHeader(query.blockNumber);
        console.log("rlpBlockHeader", rlpBlockHeader);
        await xPortal1.connect(signer).submitBlockHeader(query.targetChainId, query.blockNumber, rlpBlockHeader);

        const rlpAccountProof = await getStateProof(query.targetChainId, query.blockNumber, query.targetAccount);
        console.log(rlpAccountProof);

        const tx2 = await xPortal1.connect(signer).xResponse(source.address, query.targetChainId, query.blockNumber, query.targetAccount, rlpAccountProof);
        const receipt2 = await tx2.wait();
        console.log("xResponse receipt", receipt2);
    }
}

main();