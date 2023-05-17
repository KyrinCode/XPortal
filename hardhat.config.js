require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    localganache: {
      url: 'http://127.0.0.1:7545',
      chainId: 1337,
      accounts: [
        '0x0209f8e9b75e8cecadb61ec8cd00824e14c54d3965aace403148058d48b8c170'
      ]
    }
  }
};
