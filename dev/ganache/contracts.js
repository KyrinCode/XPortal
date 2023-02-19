const ethers = require('ethers');
const provider = require('./provider');

const contractsData = require('../../contracts.json');

const sourceData = require('../../artifacts/contracts/Source.sol/Source.json');
const xPortalData = require('../../artifacts/contracts/XPortal.sol/XPortal.json');
const targetData = require('../../artifacts/contracts/Target.sol/Target.json');
const lightClientData = require('../../artifacts/contracts/LightClient.sol/LightClient.json');

const sourceAddress = contractsData["source"];
const sourceAbi = sourceData.abi;
const source = new ethers.Contract(sourceAddress, sourceAbi, provider);

const xPortal1Address = contractsData["xPortal1"];
const xPortal2Address = contractsData["xPortal2"];
const xPortalAbi = xPortalData.abi;
const xPortal1 = new ethers.Contract(xPortal1Address, xPortalAbi, provider);
const xPortal2 = new ethers.Contract(xPortal2Address, xPortalAbi, provider);

const targetAddress = contractsData["target"];
const targetAbi = targetData.abi;
const target = new ethers.Contract(targetAddress, targetAbi, provider);

const lightClientAddress = contractsData["lightClient"];
const lightClientAbi = lightClientData.abi;
const lightClient = new ethers.Contract(lightClientAddress, lightClientAbi, provider);

module.exports = { source, xPortal1, xPortal2, target, lightClient };