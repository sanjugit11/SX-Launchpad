import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Marketplace", function () {
  let marketplace: Contract;
  let mockLaunchpadCore: Contract;
  let mockPaymentToken: Contract;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;

  const initialBalance = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // Deploy Mock Payment Token
    const ERC20Mock = await ethers.getContractFactory("SXP"); // Assuming SXP is standard ERC20
    mockPaymentToken = await ERC20Mock.deploy();
    await mockPaymentToken.waitForDeployment();

    // Deploy Mock Launchpad Core
    const MockLaunchpadCore = await ethers.getContractFactory("MockLaunchpadCore");
    mockLaunchpadCore = await MockLaunchpadCore.deploy();
    await mockLaunchpadCore.waitForDeployment();

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      await mockLaunchpadCore.getAddress(),
      await mockPaymentToken.getAddress()
    );
    await marketplace.waitForDeployment();

    // Setup initial state
    await mockPaymentToken.mint(buyer.address, initialBalance);
    await mockLaunchpadCore.mintSchedule(seller.address, 1); // Give seller schedule 1
  });

  describe("listTokens", function () {
    it("Should allow a seller to list their vesting schedule", async function () {
      const price = ethers.parseUnits("100", 6);
      const amount = ethers.parseEther("50");
      
      await expect(marketplace.connect(seller).listTokens(1, amount, price))
        .to.emit(marketplace, "TokensListed")
        .withArgs(0, seller.address, amount, price);

      const listing = await marketplace.getListing(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.scheduleIndex).to.equal(1001); // Mock new ID
      expect(listing.amount).to.equal(amount);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;

      // Verify new schedule was transferred to marketplace
      expect(await mockLaunchpadCore.scheduleOwners(1001)).to.equal(await marketplace.getAddress());
    });

    it("Should revert if price is 0", async function () {
      await expect(marketplace.connect(seller).listTokens(1, 100, 0)).to.be.revertedWith("Price must be > 0");
    });

    it("Should revert if amount is 0", async function () {
      await expect(marketplace.connect(seller).listTokens(1, 0, 100)).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert if seller does not own the schedule", async function () {
      const price = ethers.parseUnits("100", 6);
      await expect(marketplace.connect(buyer).listTokens(1, 100, price)).to.be.revertedWith("Not the schedule owner");
    });
  });

  describe("cancelListing", function () {
    beforeEach(async function () {
      const price = ethers.parseUnits("100", 6);
      const amount = ethers.parseEther("50");
      await marketplace.connect(seller).listTokens(1, amount, price);
    });

    it("Should allow the seller to cancel an active listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(0))
        .to.emit(marketplace, "TokensCancelled")
        .withArgs(0);

      const listing = await marketplace.getListing(0);
      expect(listing.isActive).to.be.false;

      // Verify schedule was transferred back to seller
      expect(await mockLaunchpadCore.scheduleOwners(1001)).to.equal(seller.address);
    });

    it("Should revert if a non-seller tries to cancel", async function () {
      await expect(marketplace.connect(buyer).cancelListing(0)).to.be.revertedWith("Not seller");
    });

    it("Should revert if the listing is already inactive", async function () {
      await marketplace.connect(seller).cancelListing(0);
      await expect(marketplace.connect(seller).cancelListing(0)).to.be.revertedWith("Listing inactive");
    });
  });

  describe("buyListing", function () {
    const price = ethers.parseUnits("100", 6);
    const amount = ethers.parseEther("50");

    beforeEach(async function () {
      await marketplace.connect(seller).listTokens(1, amount, price);
      await mockPaymentToken.connect(buyer).approve(await marketplace.getAddress(), price);
    });

    it("Should allow a buyer to purchase an active listing and distribute fees", async function () {
      await expect(marketplace.connect(buyer).buyListing(0))
        .to.emit(marketplace, "TokensPurchased")
        .withArgs(0, buyer.address, amount);

      const listing = await marketplace.getListing(0);
      expect(listing.isActive).to.be.false;

      const ptf = (price * 100n) / 10000n; // 1%
      const sellerProceeds = price - ptf;

      // Verify payment token transfer
      expect(await mockPaymentToken.balanceOf(seller.address)).to.equal(sellerProceeds);
      expect(await mockPaymentToken.balanceOf(owner.address)).to.equal(ptf);
      expect(await mockPaymentToken.balanceOf(buyer.address)).to.equal(initialBalance - price);

      // Verify schedule was transferred to buyer
      expect(await mockLaunchpadCore.scheduleOwners(1001)).to.equal(buyer.address);
    });

    it("Should revert if the buyer hasn't approved enough tokens", async function () {
      await mockPaymentToken.connect(buyer).approve(await marketplace.getAddress(), 0);
      await expect(marketplace.connect(buyer).buyListing(0)).to.be.revertedWithCustomError(mockPaymentToken, "ERC20InsufficientAllowance");
    });

    it("Should revert if the buyer doesn't have enough tokens", async function () {
      // Create a new buyer with 0 balance
      const [,,, poorBuyer] = await ethers.getSigners();
      await mockPaymentToken.connect(poorBuyer).approve(await marketplace.getAddress(), price);
      
      await expect(marketplace.connect(poorBuyer).buyListing(0)).to.be.revertedWithCustomError(mockPaymentToken, "ERC20InsufficientBalance");
    });

    it("Should revert if the listing is inactive", async function () {
      await marketplace.connect(seller).cancelListing(0);
      await expect(marketplace.connect(buyer).buyListing(0)).to.be.revertedWith("Listing inactive");
    });
  });
});
