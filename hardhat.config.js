require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    localganache: {
      url: 'http://127.0.0.1:7545',
      chainId: 1337,
      accounts: [
        '0x6d922087375998e10beb01be21a8e717ef8a6bc22b9a0ad2a0bee6f69724b754'
      ]
    }
  }
};
