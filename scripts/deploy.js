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

  const XPortal = await ethers.getContractFactory("XPortal");
  const xPortal1 = await XPortal.deploy(1);
  await xPortal1.deployed();
  console.log("XPortal1 address:", xPortal1.address);

  const xPortal2 = await XPortal.deploy(2);
  await xPortal2.deployed();
  console.log("XPortal2 address:", xPortal2.address);

  const Target = await ethers.getContractFactory("Target");
  const target = await Target.deploy();
  await target.deployed();
  console.log("Target address:", target.address);

  const LightClient = await ethers.getContractFactory("LightClient");
  const lightClient = await LightClient.deploy();
  await lightClient.deployed();
  console.log("LightClient address:", lightClient.address);

  await xPortal1.addXPortal(2, xPortal2.address);
  await xPortal2.addXPortal(1, xPortal1.address);

  await source.updateXPortal(xPortal1.address);
  await source.updateTargetContract(target.address);

  const contracts = {
    "source": source.address,
    "xPortal1": xPortal1.address,
    "xPortal2": xPortal2.address,
    "target": target.address,
    "lightClient": lightClient.address
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
