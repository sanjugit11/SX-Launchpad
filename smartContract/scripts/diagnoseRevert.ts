import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  const portalAddress = process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  const sxuaAddress = process.env.NEXT_PUBLIC_SXUA_ADDRESS;

  if (!portalAddress || !usdcAddress || !sxuaAddress) throw new Error("Missing addresses");

  const portal = await ethers.getContractAt("BuyStablesPortal", portalAddress);
  const isReg = await portal.isSXSE(deployer.address);
  console.log("Is Deployer Registered?", isReg);

  const sxua = await ethers.getContractAt("SXUA", sxuaAddress);
  const isSupported = await sxua.supportedStables(usdcAddress);
  console.log("Is USDC Supported in SXUA?", isSupported);

  try {
    console.log("Attempting to simulate buyStables...");
    await portal.buyStables.staticCall(0, 100, { value: ethers.parseEther("0.001") });
    console.log("Simulation SUCCESS! The revert must be due to the user's MetaMask address not being registered.");
  } catch (error: any) {
    console.error("Simulation REVERTED with error:", error.reason || error.message);
  }
}

main().catch(console.error);
