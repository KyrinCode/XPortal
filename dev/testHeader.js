const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
// const { BlockHeader } = require('@ethereumjs/block');
const { toBuffer, toHex } = require('@ethereumjs/util');
const { keccak256 } = require("ethereum-cryptography/keccak");
// const Header = require('./header');

const provider = require('./ganache/provider')
const { source, xPortal1, xPortal2, target, lightClient } = require('./ganache/contracts')

async function getBlockHeader(blockNumber) {
    const block = await web3.eth.getBlock(blockNumber)
    console.log('block', block);
    console.log('block hash', block.hash);
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
    console.log(data)
    const rlpBlockHeader = RLP.encode(data);
    console.log('rlp block hash', rlpBlockHeader);
    // const computedBlockHash = keccak256(rlpBlockHeader)
    // console.log('computed block hash', computedBlockHash);
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
    const tx = await lightClient.connect(signer).validateBlockHeader(blockHash, rlpBlockHeader);
    receipt = await tx.wait()
    console.log(receipt);
}

main();