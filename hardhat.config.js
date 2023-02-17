require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    localganache: {
      url: 'http://127.0.0.1:7545',
      chainId: 1337,
      accounts: [
        '0x500a7ae6bd64d63d8b74db394319a114bc7035ab618a2268f7356bfd621c02ee'
      ]
    }
  }
};
