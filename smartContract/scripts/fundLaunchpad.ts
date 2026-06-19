import { ethers } from "hardhat";

async function main() {
  const launchpadAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
  const ltTokenAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS; 
  const mpTokenAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS; 
  
  if (!launchpadAddress || !ltTokenAddress || !mpTokenAddress) throw new Error("Missing addresses");

  // In this testnet environment, SXP is used as a mock for LT and MP, and it has a public mint function
  const tokenContract = await ethers.getContractAt("SXP", ltTokenAddress);

  const amount = ethers.parseEther("10000000"); // 10,000,000 tokens

  console.log(`Funding Launchpad (${launchpadAddress}) with LT/MP tokens...`);
  const tx1 = await tokenContract.mint(launchpadAddress, amount);
  await tx1.wait();

  console.log("Launchpad funded successfully! It can now process claims and forfeits.");
}

main().catch(console.error);
