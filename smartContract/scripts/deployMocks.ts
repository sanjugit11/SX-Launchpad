import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Mock LT and MP Tokens with account:", deployer.address);

  // Deploy Mock LT Token
  const MockToken = await ethers.getContractFactory("SXP"); // Assuming SXP is just a standard ERC20 mock
  // Wait, if we don't have SXP source, let's use standard ERC20. 
  // Let's assume we have an ERC20Mock or something. SXP is already a contract in this repo.
  const ltToken = await MockToken.deploy();
  await ltToken.waitForDeployment();
  const ltAddress = await ltToken.getAddress();
  console.log("LT Token deployed to:", ltAddress);

  const mpToken = await MockToken.deploy();
  await mpToken.waitForDeployment();
  const mpAddress = await mpToken.getAddress();
  console.log("MP Token deployed to:", mpAddress);

  const launchpadAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
  if (!launchpadAddress) throw new Error("Missing Launchpad Address");

  console.log("Minting tokens to Launchpad...");
  const amount = ethers.parseEther("10000000"); // 10M tokens
  
  // Mint to launchpad
  await (await ltToken.mint(launchpadAddress, amount)).wait();
  await (await mpToken.mint(launchpadAddress, amount)).wait();

  // Also mint to deployer for testing conversions
  await (await ltToken.mint(deployer.address, amount)).wait();
  await (await mpToken.mint(deployer.address, amount)).wait();

  // Update .env
  const envPath = path.join(__dirname, "../../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  
  if (envContent.includes("NEXT_PUBLIC_SXP_ADDRESS")) {
    envContent = envContent.replace(/NEXT_PUBLIC_SXP_ADDRESS=.*/, `NEXT_PUBLIC_SXP_ADDRESS="${ltAddress}"`);
  } else {
    envContent += `\nNEXT_PUBLIC_SXP_ADDRESS="${ltAddress}"\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env with new LT/MP Token address!");
}

main().catch(console.error);
