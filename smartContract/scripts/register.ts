import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering account:", deployer.address);

  const portalAddress = process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL;
  if (!portalAddress) throw new Error("Portal address missing");

  const BuyStablesPortal = await ethers.getContractFactory("BuyStablesPortal");
  const portal = BuyStablesPortal.attach(portalAddress) as any;

  console.log("Registering deployer with SXSE...");
  const tx = await portal.registerSXSE(deployer.address, true);
  await tx.wait();

  console.log("Successfully registered!");
}

main().catch(console.error);
