import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      console.log(`Attempt ${i + 1} failed:`, e.message);
      if (i === retries - 1) throw e;
      await sleep(delay);
    }
  }
  throw new Error("Retry failed");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n=========================================`);
  console.log(`Deploying All Ecosystem Contracts on Hoodi`);
  console.log(`Deployer Account: ${deployer.address}`);
  console.log(`=========================================\n`);

  // 1. Deploy DMSVerifier
  console.log("Deploying DMSVerifier...");
  const DMSVerifier = await ethers.getContractFactory("DMSVerifier");
  const dmsVerifier = await retry(() => DMSVerifier.deploy());
  await retry(() => dmsVerifier.waitForDeployment());
  const dmsVerifierAddress = await dmsVerifier.getAddress();
  console.log(`DMSVerifier deployed at: ${dmsVerifierAddress}`);

  // 2. Deploy DIGMonitor
  console.log("Deploying DIGMonitor...");
  // Use deployer as admin1, and two generic admin wallets
  const admin2Wallet = "0xF7c106d14b2586676F5995f0f7e2f7Cce4f80fD9";
  const admin3Wallet = "0xb459e153eA3794FD7773B3e5522d3b633Ac5BE71";
  const DIGMonitor = await ethers.getContractFactory("DIGMonitor");
  const digMonitor = await retry(() =>
    DIGMonitor.deploy(
      dmsVerifierAddress,
      deployer.address,
      admin2Wallet,
      admin3Wallet
    )
  );
  await retry(() => digMonitor.waitForDeployment());
  const digMonitorAddress = await digMonitor.getAddress();
  console.log(`DIGMonitor deployed at: ${digMonitorAddress}`);

  // 3. Deploy FeeManager
  console.log("Deploying FeeManager...");
  const FeeManager = await ethers.getContractFactory("FeeManager");
  const feeManager = await retry(() => FeeManager.deploy());
  await retry(() => feeManager.waitForDeployment());
  const feeManagerAddress = await feeManager.getAddress();
  console.log(`FeeManager deployed at: ${feeManagerAddress}`);
  // // 4. Deploy TimelockController
  // console.log("Deploying TimelockController...");
  // const TimelockController = await ethers.getContractFactory(
  //   "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
  // );
  // const minDelay = 300; // 5 minutes
  // const proposers = [deployer.address];
  // const executors = [deployer.address];
  // const admin = deployer.address;
  // const timelock = await retry(() =>
  //   TimelockController.deploy(minDelay, proposers, executors, admin)
  // );
  // await retry(() => timelock.waitForDeployment());
  // const timelockAddress = await timelock.getAddress();
  // console.log(`TimelockController deployed at: ${timelockAddress}`);

  // 5. Setup Token Mocks (USDC, SXP/Reward, LT, MP)
  const SXPFactory = await ethers.getContractFactory("SXP");

  let sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS;
  if (!sxpAddress || sxpAddress === "" || sxpAddress === ethers.ZeroAddress) {
    const sxp = await retry(() => SXPFactory.deploy());
    await retry(() => sxp.waitForDeployment());
    sxpAddress = await sxp.getAddress();
    console.log(`Mock SXP deployed at: ${sxpAddress}`);
  }

  let usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!usdcAddress || usdcAddress === "" || usdcAddress === ethers.ZeroAddress) {
    const usdcMock = await retry(() => SXPFactory.deploy());
    await retry(() => usdcMock.waitForDeployment());
    usdcAddress = await usdcMock.getAddress();
    console.log(`Mock USDC deployed at: ${usdcAddress}`);
  }

  // Deploy/Get LT & MP Mocks
  const ltToken = await retry(() => SXPFactory.deploy());
  await retry(() => ltToken.waitForDeployment());
  const ltTokenAddress = await ltToken.getAddress();
  console.log(`Mock LTToken deployed at: ${ltTokenAddress}`);

  const mpToken = await retry(() => SXPFactory.deploy());
  await retry(() => mpToken.waitForDeployment());
  const mpTokenAddress = await mpToken.getAddress();
  console.log(`Mock MPToken deployed at: ${mpTokenAddress}`);

  // 6. Deploy SXUA
  console.log("Deploying SXUA...");
  const SXUA = await ethers.getContractFactory("SXUA");
  const sxua = await retry(() =>
    SXUA.deploy(sxpAddress, deployer.address, deployer.address, deployer.address)
  );
  await retry(() => sxua.waitForDeployment());
  const sxuaAddress = await sxua.getAddress();
  console.log(`SXUA deployed at: ${sxuaAddress}`);

  // Set SXUA as minter on SXP
  try {
    const sxpInstance = SXPFactory.attach(sxpAddress) as any;
    console.log("Authorizing SXUA as minter on SXP...");
    const tx = (await retry(() => sxpInstance.setMinter(sxuaAddress, true))) as any;
    await tx.wait();
  } catch (err: any) {
    console.log("Could not authorize SXUA as minter:", err.message);
  }

  // 7. Deploy LaunchpadCore
  console.log("Deploying LaunchpadCore...");
  const LaunchpadCore = await ethers.getContractFactory("LaunchpadCore");
  const tokenPrice = ethers.parseUnits("0.1", 18);
  const launchpad = await retry(() =>
    LaunchpadCore.deploy(usdcAddress, ltTokenAddress, mpTokenAddress, deployer.address, tokenPrice)
  );
  await retry(() => launchpad.waitForDeployment());
  const launchpadAddress = await launchpad.getAddress();
  console.log(`LaunchpadCore deployed at: ${launchpadAddress}`);

  // Fund Launchpad with LT and MP
  try {
    const amount = ethers.parseEther("10000000");
    console.log("Funding Launchpad with LT and MP...");
    let tx1 = await ltToken.mint(launchpadAddress, amount);
    await tx1.wait();
    let tx2 = await mpToken.mint(launchpadAddress, amount);
    await tx2.wait();
  } catch (err: any) {
    console.log("Failed to fund LaunchpadCore:", err.message);
  }

  // 8. Deploy Marketplace (ResellingMarketplace)
  console.log("Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await retry(() => Marketplace.deploy(launchpadAddress, usdcAddress));
  await retry(() => marketplace.waitForDeployment());
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`Marketplace deployed at: ${marketplaceAddress}`);

  // Authorize Marketplace on LaunchpadCore
  try {
    const tx = await launchpad.setMarketplaceAddress(marketplaceAddress);
    await tx.wait();
    console.log("Authorized Marketplace on LaunchpadCore.");
  } catch (err: any) {
    console.log("Failed to set Marketplace address:", err.message);
  }

  // 9. Deploy BuyStablesPortal
  console.log("Deploying BuyStablesPortal...");
  const BuyStablesPortal = await ethers.getContractFactory("BuyStablesPortal");
  const sxcpRouterMock = deployer.address; // Use deployer as mock router
  const portal = await retry(() =>
    BuyStablesPortal.deploy(sxuaAddress, sxcpRouterMock, usdcAddress, deployer.address)
  );
  await retry(() => portal.waitForDeployment());
  const portalAddress = await portal.getAddress();
  console.log(`BuyStablesPortal deployed at: ${portalAddress}`);

  // 10. Deploy Social (Leaderboard & Referral)
  console.log("Deploying Leaderboard & Referral...");
  const Leaderboard = await ethers.getContractFactory("Leaderboard");
  const leaderboard = await retry(() => Leaderboard.deploy());
  await retry(() => leaderboard.waitForDeployment());
  const leaderboardAddress = await leaderboard.getAddress();
  console.log(`Leaderboard deployed at: ${leaderboardAddress}`);

  const Referral = await ethers.getContractFactory("Referral");
  const referral = await retry(() => Referral.deploy(leaderboardAddress, sxpAddress));
  await retry(() => referral.waitForDeployment());
  const referralAddress = await referral.getAddress();
  console.log(`Referral deployed at: ${referralAddress}`);

  // Authorize Referral on SXP and Leaderboard
  try {
    const sxpInstance = SXPFactory.attach(sxpAddress) as any;
    console.log("Authorizing Referral as minter on SXP...");
    const tx1 = await sxpInstance.setMinter(referralAddress, true);
    await tx1.wait();

    console.log("Authorizing Referral as updater on Leaderboard...");
    const tx2 = await leaderboard.setUpdater(referralAddress, true);
    await tx2.wait();
  } catch (err: any) {
    console.log("Failed authorization steps for Referral/Leaderboard:", err.message);
  }

  // 11. Write Deployed Addresses back to .env
  const envPath = path.join(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");

    const updates = [
      { key: "NEXT_PUBLIC_SXP_ADDRESS", val: sxpAddress },
      { key: "NEXT_PUBLIC_USDC_ADDRESS", val: usdcAddress },
      { key: "NEXT_PUBLIC_SXUA_ADDRESS", val: sxuaAddress },
      { key: "NEXT_PUBLIC_BUY_STABLES_PORTAL", val: portalAddress },
      { key: "NEXT_PUBLIC_LAUNCHPAD_ADDRESS", val: launchpadAddress },
      { key: "NEXT_PUBLIC_MARKETPLACE_ADDRESS", val: marketplaceAddress },
      { key: "NEXT_PUBLIC_REFERRAL_ADDRESS", val: referralAddress },
      { key: "NEXT_PUBLIC_DMS_VERIFIER_ADDRESS", val: dmsVerifierAddress },
      { key: "NEXT_PUBLIC_DIG_MONITOR_ADDRESS", val: digMonitorAddress },
      { key: "NEXT_PUBLIC_FEE_MANAGER_ADDRESS", val: feeManagerAddress },
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
    console.log("Updated .env file with all Hoodi deployed addresses.");
  }

  console.log("\n=========================================");
  console.log("All Contracts Deployed Successfully on Hoodi!");
  console.log("=========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
