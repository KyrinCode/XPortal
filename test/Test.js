const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Source -> Endpoint and Endpoint -> Target", function () {

  async function deployFixture() {
    const [deployer, account0] = await ethers.getSigners();
    
    const Source = await ethers.getContractFactory("Source");
    const source = await Source.deploy();
    await source.deployed();

    const Endpoint = await ethers.getContractFactory("Endpoint");
    const endpoint0 = await Endpoint.deploy(0);
    await endpoint0.deployed();
    const endpoint1 = await Endpoint.deploy(1);
    await endpoint1.deployed();

    const TargetInterpreter = await ethers.getContractFactory("TargetInterpreter");
    const targetInterpreter = await TargetInterpreter.deploy();
    await targetInterpreter.deployed();

    const Target = await ethers.getContractFactory("Target");
    const target = await Target.deploy();
    await target.deployed();

    const Test = await ethers.getContractFactory("Test");
    const test = await Test.deploy();
    await test.deployed();

    return { source, endpoint0, endpoint1, targetInterpreter, target, test, deployer, account0 };
  }

  async function updateInfosFixture() {
    const { source, endpoint0, targetInterpreter, target } = await loadFixture(deployFixture);
    await source.updateEndpoint(endpoint0.address);
    await source.updateTargetInterpreter(targetInterpreter.address);
    await targetInterpreter.updateTarget(target.address);
  }

  describe("Update infos", function () {
    it("Should update the right infos", async function () {
      const { source, endpoint0, targetInterpreter, target } = await loadFixture(deployFixture);
      await loadFixture(updateInfosFixture);

      // set right endpoint, targetInterpreter and target
      expect(await source.endpoint()).to.equal(endpoint0.address);
      expect(await source.targetInterpreter()).to.equal(targetInterpreter.address);
      expect(await targetInterpreter.target()).to.equal(target.address);
    });
  });

  describe("Send payload", function () {
    it("Should emit event", async function () {
      const { source, endpoint0, targetInterpreter, account0 } = await loadFixture(deployFixture);
      await loadFixture(updateInfosFixture);

      // emit event
      const tx = await source.connect(account0).send("0xc6058474657874");
      await expect(tx).to.emit(endpoint0, "XSend").withArgs(1, targetInterpreter.address, "0x2f570a23", "0xc6058474657874");
      const receipt = await tx.wait();
      console.log(receipt);
    });

    // it("Should pick a random winner and send balance and clear the players", async function () {
    //   const { lottery, player1, player2, player3 } = await loadFixture(deployLotteryFixture);

    //   await lottery.connect(player1).enter({value: ethers.utils.parseEther("0.01")});
    //   await lottery.connect(player2).enter({value: ethers.utils.parseEther("0.01")});
    //   await lottery.connect(player3).enter({value: ethers.utils.parseEther("0.01")});
    //   const tx = await lottery.pickWinner();
    //   const receipt = await tx.wait();
    //   // send 0.03 to winner
    //   expect(receipt.events[0].event).to.equal("PickWinner")
    //   expect(receipt.events[0].args.winner).to.be.oneOf([player1.address, player2.address, player3.address]);
    //   expect(receipt.events[0].args.value).to.equal(ethers.utils.parseEther("0.03"));
    //   // winner balance 10000.02
    //   expect(await ethers.provider.getBalance(receipt.events[0].args.winner)).to.be.below(ethers.utils.parseEther("10000.02"));
    //   // clear players
    //   // assert.lengthOf(await lottery.getPlayers(), 0);
    //   expect(await lottery.getPlayers()).to.have.lengthOf(0);
    // });
  });

  describe("Test value", function () {
    it("Should return calldata", async function () {
      const { test } = await loadFixture(deployFixture);
      await loadFixture(updateInfosFixture);

      // return value
      const value = await test.testFunctionAndPayload();
      console.log(value);
    });

    it("Should parse value", async function () {
      const { test } = await loadFixture(deployFixture);
      await loadFixture(updateInfosFixture);

      // return value
      const value = "0x02f9020801828531b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000010002000000000000000000000000000000000002040000000800000000000000000000000000000004000000040000040000000000000000000000000000000010000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000008000000000000000000000000000000000040000000000000000000000000000060000000000000000000000000000000000000f8fff8fd9418c165b5e0e90a86ffef42272f3c57053a77a7bbf884a084bb3894b4ad95ba3cb7feb390b993fd1ebcc028850da4593e0b252e87d9d5e7a00000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000017fabe251a5f1ee9c5b8aeda367e2e415dc61d9a02f570a2300000000000000000000000000000000000000000000000000000000b86000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000007c605847465787400000000000000000000000000000000000000000000000000";
      const status = await test.testParseValue(value);
      console.log(status);
    });
  });
});