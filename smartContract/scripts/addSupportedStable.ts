import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const sxuaAddress = process.env.NEXT_PUBLIC_SXUA_ADDRESS;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!sxuaAddress || !usdcAddress) throw new Error("Missing env addresses");

  const sxua = await ethers.getContractAt("SXUA", sxuaAddress);
  
  console.log("Checking if USDC is supported...");
  const isSupported = await sxua.supportedStables(usdcAddress);
  console.log("Is USDC supported currently?", isSupported);

  if (!isSupported) {
    console.log("Adding USDC to SXUA supported stables...");
    // Mock USDC in this repo has 18 decimals
    const tx = await sxua.addSupportedStable(usdcAddress, 18);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("USDC added successfully!");
  } else {
    console.log("USDC is already supported!");
  }
}

main().catch(console.error);
