const ethers = require('ethers');
const provider = require('./provider');

const contractsData = require('../../contracts.json');

const sourceData = require('../../artifacts/contracts/Source.sol/Source.json');
const endpointData = require('../../artifacts/contracts/Endpoint.sol/Endpoint.json');
const targetInterpreterData = require('../../artifacts/contracts/TargetInterpreter.sol/TargetInterpreter.json');
const targetData = require('../../artifacts/contracts/Target.sol/Target.json');

const sourceAddress = contractsData["source"];
const sourceAbi = sourceData.abi;
const source = new ethers.Contract(sourceAddress, sourceAbi, provider);

const endpoint0Address = contractsData["endpoint0"];
const endpoint1Address = contractsData["endpoint1"];
const endpointAbi = endpointData.abi;
const endpoint0 = new ethers.Contract(endpoint0Address, endpointAbi, provider);
const endpoint1 = new ethers.Contract(endpoint1Address, endpointAbi, provider);

const targetInterpreterAddress = contractsData["targetInterpreter"];
const targetInterpreterAbi = targetInterpreterData.abi;
const targetInterpreter = new ethers.Contract(targetInterpreterAddress, targetInterpreterAbi, provider);

const targetAddress = contractsData["target"];
const targetAbi = targetData.abi;
const target = new ethers.Contract(targetAddress, targetAbi, provider);

module.exports = { source, endpoint0, endpoint1, targetInterpreter, target };