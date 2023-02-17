const ethers = require('ethers');

provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:7545");

const data = require('../artifacts/contracts/MerklePatriciaProof.sol/MerklePatriciaProof.json')
// console.log(data)

const address = '0x3BCD0Ebba0891c85b6D3bF2AAa0F6705378BF93D';
const abi = data.abi;
const merklePatriciaProof = new ethers.Contract(address, abi, provider);

module.exports = merklePatriciaProof;