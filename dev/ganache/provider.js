const ethers = require('ethers');

provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:7545");

module.exports = provider;