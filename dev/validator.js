const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const provider = require('./ganache/provider')
const { xPortal1, xPortal2 } = require('./ganache/contracts')

async function getBlockHeader(blockNumber) {
    const block = await web3.eth.getBlock(blockNumber);
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
    const rlpBlockHeader = RLP.encode(data);
    return {
        blockHash: block.hash,
        rlpBlockHeader: rlpBlockHeader
    };
}

async function main() {
    const signer = provider.getSigner();

    xPortal1.on("XSend", async (targetChainId, targetContract, payload, event) => {
        console.log("XSend", event);
        switch (targetChainId) {
            case 2:
                const receiptRoot = await xPortal2.getReceiptRootByBlockHeader(1, event.blockHash);
                console.log("receipt root", receiptRoot);
                if (receiptRoot == "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    const { blockHash, rlpBlockHeader } = await getBlockHeader(event.blockNumber);
                    await xPortal2.connect(signer).submitBlockHeader(1, blockHash, rlpBlockHeader);
                    const newReceiptRoot = await xPortal2.getReceiptRootByBlockHeader(1, event.blockHash);
                    console.log("new receipt root", newReceiptRoot);
                }
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