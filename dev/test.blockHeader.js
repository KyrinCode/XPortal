const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');

const provider = require('./ganache/provider')
const { lightClient } = require('./ganache/contracts')

async function getBlockHeader(blockNumber) {
    const block = await web3.eth.getBlock(blockNumber)
    console.log('block', block);
    // const blockHeader = Header.fromRpc(block);
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
    const rlpBlockHeader = RLP.encode(data);
    return {
        blockHash: block.hash,
        rlpBlockHeader: rlpBlockHeader
    };
}

async function main() {
    const signer = provider.getSigner();
    console.log(signer)

    const { blockHash, rlpBlockHeader } = await getBlockHeader(100);
    console.log(blockHash);
    console.log(rlpBlockHeader);
    const success = await lightClient.validateBlockHeader(blockHash, rlpBlockHeader);
    console.log(success);

    await lightClient.connect(signer).submitBlockHeader(blockHash, rlpBlockHeader);

    const stateRoot = await lightClient.getStateRootByBlockHeader(blockHash);
    const receiptRoot = await lightClient.getReceiptRootByBlockHeader(blockHash);
    console.log(stateRoot)
    console.log(receiptRoot)
}

main();