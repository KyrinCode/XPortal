const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying the contract with the account:", deployer.address);

  // const MerklePatriciaProof = await ethers.getContractFactory("MerklePatriciaProof");
  // const merklePatriciaProof = await MerklePatriciaProof.deploy();
  // await merklePatriciaProof.deployed();
  // console.log("MerklePatriciaProof address:", merklePatriciaProof.address);

  const Source = await ethers.getContractFactory("Source");
  const source = await Source.deploy();
  await source.deployed();
  console.log("Source address:", source.address);

  const Endpoint = await ethers.getContractFactory("Endpoint");
  const endpoint0 = await Endpoint.deploy(0);
  await endpoint0.deployed();
  console.log("Endpoint0 address:", endpoint0.address);
  const endpoint1 = await Endpoint.deploy(1);
  await endpoint1.deployed();
  console.log("Endpoint1 address:", endpoint1.address);

  const TargetInterpreter = await ethers.getContractFactory("TargetInterpreter");
  const targetInterpreter = await TargetInterpreter.deploy();
  await targetInterpreter.deployed();
  console.log("TargetInterpreter address:", targetInterpreter.address);

  const Target = await ethers.getContractFactory("Target");
  const target = await Target.deploy();
  await target.deployed();
  console.log("Target address:", target.address);

  await source.updateEndpoint(endpoint0.address);
  await source.updateTargetInterpreter(targetInterpreter.address);
  await targetInterpreter.updateTarget(target.address);

  const contracts = {
    "source": source.address,
    "endpoint0": endpoint0.address,
    "endpoint1": endpoint1.address,
    "targetInterpreter": targetInterpreter.address,
    "target": target.address
  }
  fs.writeFile("contracts.json", JSON.stringify(contracts), 'utf8', function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("contracts.json has been saved.");
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
