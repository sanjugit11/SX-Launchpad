import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, retries = 10, delay = 3000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      console.log(`Attempt ${i+1} failed:`, e.message);
      if (i === retries - 1) throw e;
      await sleep(delay);
    }
  }
  throw new Error("Retry failed");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy Mock Tokens for Testnet
  console.log("\n--- Deploying Mock Tokens ---");
  const SXP = await ethers.getContractFactory("SXP");
  const sxp = await retry(() => SXP.deploy());
  await retry(() => sxp.waitForDeployment());
  const sxpAddress = await sxp.getAddress();
  console.log("SXP deployed to:", sxpAddress);

  const MockToken = await ethers.getContractFactory("SXP"); // Using SXP as a generic ERC20 mock
  const usdc = MockToken.attach("0x45E37F08DEA749181e5f97628Dd7A0b985867826");
  const usdcAddress = await usdc.getAddress();
  console.log("Mock USDC deployed to:", usdcAddress);

  const ltToken = MockToken.attach("0x572A8Ce82155E621F6D27106977118C09d7eAfF3");
  const ltTokenAddress = await ltToken.getAddress();
  console.log("Mock LTToken deployed to:", ltTokenAddress);

  const mpToken = MockToken.attach("0xbec8511F2c25A9Ad6D3AD556E7303C5E4ceEc593")
  const mpTokenAddress = await mpToken.getAddress();
  console.log("Mock MPToken deployed to:", mpTokenAddress);

  // 2. Deploy Governance
  console.log("\n--- Deploying Governance ---");
  const DMSVerifier = await ethers.getContractFactory("DMSVerifier");
  const dmsVerifier = await retry(() => DMSVerifier.deploy());
  await retry(() => dmsVerifier.waitForDeployment());
  const dmsVerifierAddress = await dmsVerifier.getAddress();
  console.log("DMSVerifier deployed to:", dmsVerifierAddress);

  const FeeManager = await ethers.getContractFactory("FeeManager");
  const feeManager = await retry(() => FeeManager.deploy());
  await retry(() => feeManager.waitForDeployment());
  console.log("FeeManager deployed to:", await feeManager.getAddress());

  const admin2Wallet = new ethers.Wallet("0x7c85211111111111111111111111111111111111111111111111111111111112");
  const admin3Wallet = new ethers.Wallet("0x7c85211111111111111111111111111111111111111111111111111111111113");
  console.log("Admin 2 address:", admin2Wallet.address);
  console.log("Admin 3 address:", admin3Wallet.address);

  const DIGMonitor = await ethers.getContractFactory("DIGMonitor");
  const digMonitorAddress = await retry(async () => {
    const dig = await DIGMonitor.deploy(dmsVerifierAddress, deployer.address, admin2Wallet.address, admin3Wallet.address);
    await dig.waitForDeployment();
    return await dig.getAddress();
  });
  console.log("DIGMonitor deployed to:", digMonitorAddress);

  // 3. Deploy Core (SXUA & Launchpad)
  console.log("\n--- Deploying Core ---");
  const SXUA = await ethers.getContractFactory("SXUA");
  const sxmmAddress = deployer.address; // Mock SXMM
  const treasuryAddress = deployer.address; // Mock Treasury
  
  const sxua = await retry(() => SXUA.deploy(sxpAddress, sxmmAddress, treasuryAddress, treasuryAddress));
  await retry(() => sxua.waitForDeployment());
  const sxuaAddress = await sxua.getAddress();
  console.log("SXUA deployed to:", sxuaAddress);

  // Set SXUA as minter on SXP
  console.log("Authorizing SXUA as minter on SXP...");
  await retry(async () => {
    const tx = await sxp.setMinter(sxuaAddress, true);
    await tx.wait();
  });

  const LaunchpadCore = await ethers.getContractFactory("LaunchpadCore");
  const tokenPrice = ethers.parseUnits("0.1", 18); // 0.1 USDC per Token
  const launchpadCore = await retry(() => LaunchpadCore.deploy(usdcAddress, ltTokenAddress, mpTokenAddress, treasuryAddress, tokenPrice));
  await retry(() => launchpadCore.waitForDeployment());
  const launchpadCoreAddress = await launchpadCore.getAddress();
  console.log("LaunchpadCore deployed to:", launchpadCoreAddress);

  // 4. Deploy Market & Portal
  console.log("\n--- Deploying Market & Portal ---");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await retry(() => Marketplace.deploy(launchpadCoreAddress, usdcAddress));
  await retry(() => marketplace.waitForDeployment());
  const marketplaceAddress = await marketplace.getAddress();
  console.log("Marketplace deployed to:", marketplaceAddress);

  const BuyStablesPortal = await ethers.getContractFactory("BuyStablesPortal");
  const sxcpRouterMock = deployer.address; // Mock router
  const portal = await retry(() => BuyStablesPortal.deploy(sxuaAddress, sxcpRouterMock, usdcAddress, treasuryAddress));
  await retry(() => portal.waitForDeployment());
  const portalAddress = await portal.getAddress();
  console.log("BuyStablesPortal deployed to:", portalAddress);

  // 5. Deploy Social (Leaderboard & Referral)
  console.log("\n--- Deploying Social ---");
  const Leaderboard = await ethers.getContractFactory("Leaderboard");
  const leaderboard = await retry(() => Leaderboard.deploy());
  await retry(() => leaderboard.waitForDeployment());
  const leaderboardAddress = await leaderboard.getAddress();
  console.log("Leaderboard deployed to:", leaderboardAddress);

  const Referral = await ethers.getContractFactory("Referral");
  const referral = await retry(() => Referral.deploy(leaderboardAddress, sxpAddress));
  await retry(() => referral.waitForDeployment());
  const referralAddress = await referral.getAddress();
  console.log("Referral deployed to:", referralAddress);

  // Authorize Referral as minter on SXP
  console.log("Authorizing Referral as minter on SXP...");
  await retry(async () => {
    const tx = await sxp.setMinter(referralAddress, true);
    await tx.wait();
  });

  // Authorize Referral as updater on Leaderboard
  console.log("Authorizing Referral as updater on Leaderboard...");
  await retry(async () => {
    const tx = await leaderboard.setUpdater(referralAddress, true);
    await tx.wait();
  });

  console.log("\n🎉 All contracts deployed successfully!");

  // Update .env file
  const envPath = path.join(__dirname, "../../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  
  const updates = [
    { key: "NEXT_PUBLIC_SXP_ADDRESS", val: sxpAddress },
    { key: "NEXT_PUBLIC_SXUA_ADDRESS", val: sxuaAddress },
    { key: "NEXT_PUBLIC_LAUNCHPAD_ADDRESS", val: launchpadCoreAddress },
    { key: "NEXT_PUBLIC_MARKETPLACE_ADDRESS", val: marketplaceAddress },
    { key: "NEXT_PUBLIC_BUY_STABLES_PORTAL", val: portalAddress },
    { key: "NEXT_PUBLIC_REFERRAL_ADDRESS", val: referralAddress },
    { key: "NEXT_PUBLIC_DMS_VERIFIER_ADDRESS", val: dmsVerifierAddress },
    { key: "NEXT_PUBLIC_DIG_MONITOR_ADDRESS", val: digMonitorAddress }
  ];

  for (const item of updates) {
    const regex = new RegExp(`${item.key}=.*`);
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${item.key}="${item.val}"`);
    } else {
      envContent += `\n${item.key}="${item.val}"\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("Successfully updated .env file with new addresses!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
