const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const provider = require('./ganache/provider')
const { source } = require('./ganache/contracts')

async function main() {
    const signer = provider.getSigner();
    console.log("first tx start", Date.now())
    // test xSend
    await source.connect(signer).send();
    // test xCall
    // await source.connect(signer).call1();
    console.log("first tx end", Date.now())
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});