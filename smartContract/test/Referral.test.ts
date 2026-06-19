import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Referral", function () {
  async function deployReferralFixture() {
    const [owner, referrer, user, otherAccount] = await ethers.getSigners();

    // Deploy SXP Token (Reward Token)
    const SXP = await ethers.getContractFactory("SXP");
    const rewardToken = await SXP.deploy();
    await rewardToken.waitForDeployment();

    // Deploy Mock Leaderboard
    // We use a mock to bypass the actual contract's access controls for this isolated test
    const Leaderboard = await ethers.getContractFactory("MockLeaderboard");
    const leaderboard = await Leaderboard.deploy();
    await leaderboard.waitForDeployment();

    // Deploy Referral
    const Referral = await ethers.getContractFactory("Referral");
    const referral = await Referral.deploy(
      await leaderboard.getAddress(),
      await rewardToken.getAddress()
    );
    await referral.waitForDeployment();

    // Transfer ownership of SXP to the Referral contract so it has rights to mint rewards
    await rewardToken.transferOwnership(await referral.getAddress());

    return { referral, leaderboard, rewardToken, owner, referrer, user, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { referral, owner } = await loadFixture(deployReferralFixture);
      expect(await referral.owner()).to.equal(owner.address);
    });

    it("Should set leaderboard and reward token correctly", async function () {
      const { referral, leaderboard, rewardToken } = await loadFixture(deployReferralFixture);
      expect(await referral.leaderboard()).to.equal(await leaderboard.getAddress());
      expect(await referral.rewardToken()).to.equal(await rewardToken.getAddress());
    });

    it("Should have the correct default reward amount", async function () {
      const { referral } = await loadFixture(deployReferralFixture);
      expect(await referral.rewardAmount()).to.equal(ethers.parseUnits("100", 18));
    });
  });

  describe("createReferral", function () {
    it("Should successfully create a referral code", async function () {
      const { referral, referrer } = await loadFixture(deployReferralFixture);

      await expect(referral.connect(referrer).createReferral("REF123"))
        .to.emit(referral, "ReferralRegistered")
        .withArgs(referrer.address, "REF123");

      expect(await referral.codeToReferrer("REF123")).to.equal(referrer.address);
      expect(await referral.referrerToCode(referrer.address)).to.equal("REF123");
    });

    it("Should revert if code is empty", async function () {
      const { referral, referrer } = await loadFixture(deployReferralFixture);
      await expect(referral.connect(referrer).createReferral("")).to.be.revertedWith("Code cannot be empty");
    });

    it("Should revert if code already exists", async function () {
      const { referral, referrer, otherAccount } = await loadFixture(deployReferralFixture);
      await referral.connect(referrer).createReferral("REF123");
      
      await expect(referral.connect(otherAccount).createReferral("REF123")).to.be.revertedWith("Code already exists");
    });

    it("Should revert if referrer already has a code", async function () {
      const { referral, referrer } = await loadFixture(deployReferralFixture);
      await referral.connect(referrer).createReferral("REF123");
      
      await expect(referral.connect(referrer).createReferral("REF456")).to.be.revertedWith("Referrer already has a code");
    });
  });

  describe("completeReferral", function () {
    it("Should successfully complete a referral and mint rewards", async function () {
      const { referral, rewardToken, referrer, user } = await loadFixture(deployReferralFixture);
      await referral.connect(referrer).createReferral("REF123");

      const rewardAmount = await referral.rewardAmount();

      // Complete referral
      await expect(referral.connect(user).completeReferral("REF123"))
        .to.emit(referral, "ReferralCompleted")
        .withArgs(referrer.address, user.address, rewardAmount);

      // Verify stats incremented correctly
      const stats = await referral.getReferralStats(referrer.address);
      expect(stats.totalReferrals).to.equal(1n);
      expect(stats.successfulReferrals).to.equal(1n);

      // Verify user mapping is populated
      expect(await referral.userToReferrer(user.address)).to.equal(referrer.address);

      // Verify SXP reward token was successfully minted to both the referrer and referee
      expect(await rewardToken.balanceOf(referrer.address)).to.equal(rewardAmount);
      expect(await rewardToken.balanceOf(user.address)).to.equal(rewardAmount);
    });

    it("Should revert if referral code is invalid", async function () {
      const { referral, user } = await loadFixture(deployReferralFixture);
      await expect(referral.connect(user).completeReferral("INVALID")).to.be.revertedWith("Invalid referral code");
    });

    it("Should revert on self-referral", async function () {
      const { referral, referrer } = await loadFixture(deployReferralFixture);
      await referral.connect(referrer).createReferral("REF123");

      await expect(referral.connect(referrer).completeReferral("REF123")).to.be.revertedWith("Self-referral protection");
    });

    it("Should revert if user has already been referred", async function () {
      const { referral, referrer, otherAccount, user } = await loadFixture(deployReferralFixture);
      await referral.connect(referrer).createReferral("REF123");
      await referral.connect(otherAccount).createReferral("REF456");

      // First usage
      await referral.connect(user).completeReferral("REF123");

      // Attempting to be referred again (either by same or different person) should fail
      await expect(referral.connect(user).completeReferral("REF123")).to.be.revertedWith("Duplicate protection: already referred");
      await expect(referral.connect(user).completeReferral("REF456")).to.be.revertedWith("Duplicate protection: already referred");
    });
  });
});