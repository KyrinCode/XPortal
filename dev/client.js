const Web3 = require('web3');
const web3 = new Web3("http://127.0.0.1:7545");

const provider = require('./ganache/provider')
const { source } = require('./ganache/contracts')

async function main() {
    const signer = provider.getSigner();
    await source.connect(signer).send();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});