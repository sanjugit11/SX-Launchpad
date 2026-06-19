import { ethers } from "hardhat";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Minting USDC for account:", deployer.address);

  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!usdcAddress) throw new Error("Missing USDC");

  const usdc = await ethers.getContractAt("SXP", usdcAddress);

  const amount = ethers.parseEther("10000"); // 10,000 USDC (18 decimals)
  
  let success = false;
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`Attempt ${i + 1}...`);
      const tx = await usdc.mint(deployer.address, amount);
      await tx.wait();
      success = true;
      break;
    } catch (e: any) {
      console.error(e.message);
      await sleep(2000);
    }
  }

  if (success) {
    console.log("Successfully minted 10,000 USDC to your wallet!");
  } else {
    console.error("Failed to mint USDC after 5 attempts.");
  }
}

main().catch(console.error);
