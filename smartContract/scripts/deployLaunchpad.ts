import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying LaunchpadCore with account:", deployer.address);

  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  const ltTokenAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS; // Using SXP as mock LT for simplicity, or we deploy a new one
  const mpTokenAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS; // Mock MP
  const treasuryAddress = deployer.address;

  if (!usdcAddress) throw new Error("Missing USDC");

  const LaunchpadCore = await ethers.getContractFactory("LaunchpadCore");
  // 0.1 USDC per Token = 100000000000000000 wei if 18 decimals
  const tokenPrice = ethers.parseUnits("0.1", 18); 
  const launchpad = await LaunchpadCore.deploy(
    usdcAddress, 
    ltTokenAddress!, 
    mpTokenAddress!, 
    treasuryAddress, 
    tokenPrice
  );
  await launchpad.waitForDeployment();
  const address = await launchpad.getAddress();
  
  console.log("LaunchpadCore deployed to:", address);

  const envPath = path.join(__dirname, "../../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  if (envContent.includes("NEXT_PUBLIC_LAUNCHPAD_ADDRESS")) {
    envContent = envContent.replace(/NEXT_PUBLIC_LAUNCHPAD_ADDRESS=.*/, `NEXT_PUBLIC_LAUNCHPAD_ADDRESS="${address}"`);
  } else {
    envContent += `\nNEXT_PUBLIC_LAUNCHPAD_ADDRESS="${address}"\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env with NEXT_PUBLIC_LAUNCHPAD_ADDRESS");
}

main().catch(console.error);
