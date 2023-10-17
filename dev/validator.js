const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const { RLP } = require('@ethereumjs/rlp');
const ethers = require('ethers');
const provider = require('./ganache/provider')
const { xPortal1, xPortal2 } = require('./ganache/contracts')

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

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

async function main() {
    const signer = provider.getSigner();

    xPortal1.on("XSend", async (sourceContract, _targetChainId, targetContract, payload, event) => {
        console.log("XSend", event);
        console.log("first relay start", Date.now())
        const targetChainId = ethers.BigNumber.from(_targetChainId).toNumber()

        const blockHash = await xPortal2.getBlockHash(1, event.blockNumber);
        console.log("block hash", blockHash);
        if (blockHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const { rlpBlockHeader } = await getRlpBlockHeader(event.blockNumber);
            console.log("first relay end", Date.now())
            await wait(2000);
            console.log("second tx start", Date.now())
            tx = await xPortal2.connect(signer).submitBlockHeader(1, event.blockNumber, rlpBlockHeader);
            console.log("second tx end", Date.now())
            
            // const tx = await provider.getTransaction("0xafef64d0d03db9f13c6c3f8aec5902167ea680bd0ffa0268d89a426d624b2ae1");
            const unsignedTx = {
                to: tx.to,
                nonce: tx.nonce,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice,
                data: tx.data,
                value: tx.value,
                chainId: tx.chainId
            };
            const signature = {
                v: tx.v,
                r: tx.r,
                s: tx.s
            }
            const serialized = ethers.utils.serializeTransaction(unsignedTx, signature);
            console.log("serialized", serialized);

            console.log("tx", tx);
            const newReceiptRoot = await xPortal2.getReceiptRoot(1, event.blockNumber);
            console.log("new receipt root", newReceiptRoot);
        }
    });

    xPortal1.on("XCall", async (sourceContract, _targetChainId, _blockNumber, targetAccount, slots, event) => {
        console.log("XCall", event);
        console.log("first relay start", Date.now())
        const targetChainId = ethers.BigNumber.from(_targetChainId).toNumber();
        const blockNumber = ethers.BigNumber.from(_blockNumber).toNumber();

        const blockHash = await xPortal1.getBlockHash(targetChainId, blockNumber);
        console.log("block hash", blockHash);
        if (blockHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const { rlpBlockHeader } = await getRlpBlockHeader(blockNumber);
            console.log("first relay end", Date.now())
            await wait(2000);
            console.log("second tx start", Date.now())
            await xPortal1.connect(signer).submitBlockHeader(targetChainId, blockNumber, rlpBlockHeader);
            console.log("second tx end", Date.now())
            const newReceiptRoot = await xPortal1.getReceiptRoot(targetChainId, blockNumber);
            console.log("new receipt root", newReceiptRoot);
        }
    })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});