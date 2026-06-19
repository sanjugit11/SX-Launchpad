import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
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
  console.log("Deploying everything with account:", deployer.address);

  const MockToken = await ethers.getContractFactory("SXP"); 
  
  const ltToken = await retry(() => MockToken.deploy());
  await retry(() => ltToken.waitForDeployment());
  const ltTokenAddress = await ltToken.getAddress();
  
  const mpToken = await retry(() => MockToken.deploy());
  await retry(() => mpToken.waitForDeployment());
  const mpTokenAddress = await mpToken.getAddress();
  
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!usdcAddress) throw new Error("Missing USDC");
  
  const treasuryAddress = deployer.address;
  const tokenPrice = ethers.parseUnits("0.1", 18); 

  console.log("Deploying LaunchpadCore...");
  const LaunchpadCore = await ethers.getContractFactory("LaunchpadCore");
  const launchpad = await retry(() => LaunchpadCore.deploy(
    usdcAddress, 
    ltTokenAddress, 
    mpTokenAddress, 
    treasuryAddress, 
    tokenPrice
  ));
  await retry(() => launchpad.waitForDeployment());
  const launchpadAddress = await launchpad.getAddress();
  
  console.log("LaunchpadCore deployed to:", launchpadAddress);

  console.log("Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await retry(() => Marketplace.deploy(launchpadAddress, usdcAddress));
  await retry(() => marketplace.waitForDeployment());
  const marketplaceAddress = await marketplace.getAddress();
  
  console.log("Marketplace deployed to:", marketplaceAddress);

  console.log("Authorizing Marketplace on LaunchpadCore...");
  await retry(async () => {
    const tx = await launchpad.setMarketplaceAddress(marketplaceAddress);
    await tx.wait();
  });

  const amount = ethers.parseEther("10000000"); 
  console.log("Funding Launchpad with LT and MP...");
  await retry(async () => {
    const tx = await ltToken.mint(launchpadAddress, amount);
    await tx.wait();
  });
  await retry(async () => {
    const tx = await mpToken.mint(launchpadAddress, amount);
    await tx.wait();
  });

  const envPath = path.join(__dirname, "../../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  
  if (envContent.includes("NEXT_PUBLIC_LAUNCHPAD_ADDRESS")) {
    envContent = envContent.replace(/NEXT_PUBLIC_LAUNCHPAD_ADDRESS=.*/, `NEXT_PUBLIC_LAUNCHPAD_ADDRESS="${launchpadAddress}"`);
  } else {
    envContent += `\nNEXT_PUBLIC_LAUNCHPAD_ADDRESS="${launchpadAddress}"\n`;
  }

  if (envContent.includes("NEXT_PUBLIC_MARKETPLACE_ADDRESS")) {
    envContent = envContent.replace(/NEXT_PUBLIC_MARKETPLACE_ADDRESS=.*/, `NEXT_PUBLIC_MARKETPLACE_ADDRESS="${marketplaceAddress}"`);
  } else {
    envContent += `\nNEXT_PUBLIC_MARKETPLACE_ADDRESS="${marketplaceAddress}"\n`;
  }

  if (envContent.includes("NEXT_PUBLIC_SXP_ADDRESS")) {
    envContent = envContent.replace(/NEXT_PUBLIC_SXP_ADDRESS=.*/, `NEXT_PUBLIC_SXP_ADDRESS="${ltTokenAddress}"`);
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("Successfully deployed and funded all contracts! Updated .env!");
}

main().catch(console.error);
