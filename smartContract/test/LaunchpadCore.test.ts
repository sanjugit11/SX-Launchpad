import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LaunchpadCore", function () {
  async function deployLaunchpadFixture() {
    const [owner, user1, user2, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("SXP");
    const paymentToken = await Token.deploy();
    await paymentToken.waitForDeployment();

    const ltToken = await Token.deploy();
    await ltToken.waitForDeployment();

    const mpToken = await Token.deploy();
    await mpToken.waitForDeployment();

    const price = ethers.parseUnits("1", 18);
    const Launchpad = await ethers.getContractFactory("LaunchpadCore");
    const launchpad = await Launchpad.deploy(
      await paymentToken.getAddress(),
      await ltToken.getAddress(),
      await mpToken.getAddress(),
      treasury.address,
      price
    );
    await launchpad.waitForDeployment();

    await paymentToken.mint(user1.address, ethers.parseUnits("1000", 18));
    await ltToken.mint(await launchpad.getAddress(), ethers.parseUnits("1000", 18));
    await mpToken.mint(await launchpad.getAddress(), ethers.parseUnits("1000", 18));

    // Set marketplaceAddress to owner for testing marketplace functions
    await launchpad.setMarketplaceAddress(owner.address);

    return {
      owner,
      user1,
      user2,
      treasury,
      paymentToken,
      ltToken,
      mpToken,
      launchpad,
      price,
    };
  }

  describe("Deployment", function () {
    it("should set the correct owner and config", async function () {
      const { owner, launchpad, treasury, price } = await deployLaunchpadFixture();

      expect(await launchpad.owner()).to.equal(owner.address);
      expect(await launchpad.treasury()).to.equal(treasury.address);
      expect(await launchpad.tokenPrice()).to.equal(price);
    });
  });

  describe("purchaseTokens", function () {
    it("should purchase LT and store an active vesting schedule", async function () {
      const { paymentToken, launchpad, user1, treasury } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("100", 18);
      const expectedTotal = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), expectedTotal);

      await expect(launchpad.connect(user1).purchaseTokens(amountLT))
        .to.emit(launchpad, "TokensPurchased")
        .withArgs(1n, user1.address, amountLT);

      expect(await paymentToken.balanceOf(treasury.address)).to.equal(expectedTotal);
      expect(await paymentToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("900", 18));

      const schedule = await launchpad.purchases(1);
      expect(schedule.amountLT).to.equal(amountLT);
      expect(schedule.claimedAmount).to.equal(0);
      expect(schedule.isActive).to.equal(true);
      expect(schedule.purchaseTime).to.be.a("bigint").that.is.greaterThan(0n);
    });

    it("should revert when amount is zero", async function () {
      const { launchpad, user1 } = await deployLaunchpadFixture();
      await expect(launchpad.connect(user1).purchaseTokens(0n)).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("claimVested", function () {
    it("should allow claiming after full vesting duration", async function () {
      const { paymentToken, launchpad, ltToken, user1, treasury } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("50", 18);
      const totalCost = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), totalCost);
      await launchpad.connect(user1).purchaseTokens(amountLT);

      const schedule = await launchpad.purchases(1);
      const claimTime = schedule.vestingEnd;
      await time.increaseTo(claimTime);

      const expectedFee = (amountLT * 200n) / 10000n;
      const expectedTransfer = amountLT - expectedFee;

      await expect(launchpad.connect(user1).claimVested(1))
        .to.emit(launchpad, "MintingCostPaid")
        .withArgs(1n, user1.address, expectedFee)
        .and.to.emit(launchpad, "VestedTokensClaimed")
        .withArgs(1n, user1.address, expectedTransfer);

      expect(await ltToken.balanceOf(user1.address)).to.equal(expectedTransfer);
      expect(await ltToken.balanceOf(treasury.address)).to.equal(expectedFee);
      const finalSchedule = await launchpad.purchases(1);
      expect(finalSchedule.isActive).to.equal(false);
      expect(finalSchedule.claimedAmount).to.equal(amountLT);
    });

    it("should revert if vesting is not complete", async function () {
      const { paymentToken, launchpad, user1 } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("25", 18);
      const totalCost = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), totalCost);
      await launchpad.connect(user1).purchaseTokens(amountLT);

      const schedule = await launchpad.purchases(1);
      const tooSoon = schedule.vestingEnd - 100n;
      await time.increaseTo(tooSoon);

      await expect(launchpad.connect(user1).claimVested(1)).to.be.revertedWith("Vesting not complete");
    });
  });

  describe("forfeitPurchase", function () {
    it("should forfeit the schedule and mark it inactive", async function () {
      const { paymentToken, launchpad, user1, treasury, ltToken } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("20", 18);
      const totalCost = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), totalCost);
      await launchpad.connect(user1).purchaseTokens(amountLT);

      await expect(launchpad.connect(user1).forfeitPurchase(1))
        .to.emit(launchpad, "ForfeitureExecuted")
        .withArgs(1n, user1.address, amountLT);

      const schedule = await launchpad.purchases(1);
      expect(schedule.isActive).to.equal(false);
      expect(schedule.amountLT).to.equal(0);
      expect(await ltToken.balanceOf(treasury.address)).to.equal(amountLT);
    });

    it("should revert when schedule is already inactive", async function () {
      const { paymentToken, launchpad, user1 } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("20", 18);
      const totalCost = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), totalCost);
      await launchpad.connect(user1).purchaseTokens(amountLT);
      await launchpad.connect(user1).forfeitPurchase(1);

      await expect(launchpad.connect(user1).forfeitPurchase(1)).to.be.revertedWith("Schedule inactive");
    });
  });

  describe("convertToMP", function () {
    it("should convert LT tokens to MP tokens 1:10", async function () {
      const { launchpad, ltToken, mpToken, user1, treasury } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("30", 18);

      await ltToken.mint(user1.address, amountLT);
      await ltToken.connect(user1).approve(await launchpad.getAddress(), amountLT);

      await expect(launchpad.connect(user1).convertToMP(amountLT))
        .to.emit(launchpad, "TokensConvertedToMP")
        .withArgs(user1.address, amountLT);

      const expectedMP = amountLT * 10n;
      expect(await mpToken.balanceOf(user1.address)).to.equal(expectedMP);
      expect(await ltToken.balanceOf(treasury.address)).to.equal(amountLT);
      expect(await ltToken.balanceOf(await launchpad.getAddress())).to.equal(ethers.parseUnits("1000", 18));
    });

    it("should revert when conversion amount is zero", async function () {
      const { launchpad, user1 } = await deployLaunchpadFixture();
      await expect(launchpad.connect(user1).convertToMP(0n)).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("transferVestingSchedule", function () {
    it("should transfer an active vesting schedule to another user", async function () {
      const { paymentToken, launchpad, user1, user2 } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("40", 18);
      const totalCost = amountLT;

      await paymentToken.connect(user1).approve(await launchpad.getAddress(), totalCost);
      await launchpad.connect(user1).purchaseTokens(amountLT);

      // Called by owner (who is marketplaceAddress in the fixture)
      await launchpad.transferVestingSchedule(user1.address, user2.address, 1);

      const schedule = await launchpad.purchases(1);
      expect(schedule.user).to.equal(user2.address);
      expect(schedule.isActive).to.equal(true);
      expect(schedule.amountLT).to.equal(amountLT);
      expect(schedule.claimedAmount).to.equal(0);
    });

    it("should revert when the source schedule index is invalid", async function () {
      const { launchpad, user1 } = await deployLaunchpadFixture();
      await expect(launchpad.transferVestingSchedule(user1.address, user1.address, 0))
        .to.be.revertedWith("Schedule inactive");
    });

    it("should revert when not called by marketplace", async function () {
      const { launchpad, user1, user2 } = await deployLaunchpadFixture();
      const amountLT = ethers.parseUnits("40", 18);
      
      await expect(launchpad.connect(user1).transferVestingSchedule(user1.address, user2.address, 1))
        .to.be.revertedWith("Only marketplace");
    });
  });
});
