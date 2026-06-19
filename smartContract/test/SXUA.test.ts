import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SXUA Contract", function () {
  async function deploySXUAFixture() {
    const [owner, user1, sxmm, ptfFeeWallet, withdrawalFeeWallet] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockERC20 = await ethers.getContractFactory("SXP"); // We'll just use SXP logic for a mock token
    const mockUSDC = await MockERC20.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy SXP Token
    const SXP = await ethers.getContractFactory("SXP");
    const sxpToken = await SXP.deploy();
    await sxpToken.waitForDeployment();

    // Deploy SXUA
    const SXUA = await ethers.getContractFactory("SXUA");
    const sxua = await SXUA.deploy(
      await sxpToken.getAddress(),
      sxmm.address,
      ptfFeeWallet.address,
      withdrawalFeeWallet.address
    );
    await sxua.waitForDeployment();

    // Transfer ownership of SXP to SXUA so SXUA can mint SXP
    await sxpToken.transferOwnership(await sxua.getAddress());

    // Add Mock USDC as supported stablecoin
    await sxua.addSupportedStable(await mockUSDC.getAddress(), 18);

    // Mint some Mock USDC to user1 for testing
    await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 18));

    return { sxua, sxpToken, mockUSDC, owner, user1, sxmm, ptfFeeWallet, withdrawalFeeWallet };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { sxua, owner } = await loadFixture(deploySXUAFixture);
      expect(await sxua.owner()).to.equal(owner.address);
    });

    it("Should set supported stablecoin correctly", async function () {
      const { sxua, mockUSDC } = await loadFixture(deploySXUAFixture);
      expect(await sxua.supportedStables(await mockUSDC.getAddress())).to.be.true;
    });
  });

  describe("Deposits", function () {
    it("Should deposit and mint SXP successfully", async function () {
      const { sxua, sxpToken, mockUSDC, user1, ptfFeeWallet } = await loadFixture(deploySXUAFixture);

      const depositAmount = ethers.parseUnits("100", 18);
      
      // Approve SXUA to spend user's USDC
      await mockUSDC.connect(user1).approve(await sxua.getAddress(), depositAmount);

      // Deposit with 50% split
      await expect(sxua.connect(user1).depositWithSplit(await mockUSDC.getAddress(), depositAmount, 50))
        .to.emit(sxua, "Deposited")
        .withArgs(user1.address, 1, depositAmount, await mockUSDC.getAddress());

      // Check Balances
      const balances = await sxua.getBalances(user1.address);
      
      // 0.5% PTF fee on 100 is 0.5. Net amount is 99.5. Split is 50%, so 49.75 committed, 49.75 uncommitted.
      const expectedNet = ethers.parseUnits("99.5", 18);
      const expectedCommitted = expectedNet / 2n;

      expect(balances.totalCommitted).to.equal(expectedCommitted);
      expect(balances.totalUncommitted).to.equal(expectedNet - expectedCommitted);

      // Verify SXP was minted (1:1 ratio with net deposit)
      expect(await sxpToken.balanceOf(user1.address)).to.equal(expectedNet);

      // Verify PTF fee was collected
      expect(await mockUSDC.balanceOf(ptfFeeWallet.address)).to.equal(ethers.parseUnits("0.5", 18));
    });
  });
});
