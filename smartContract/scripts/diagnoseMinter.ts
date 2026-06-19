import { ethers } from "hardhat";

async function main() {
  const sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS;
  const sxuaAddress = process.env.NEXT_PUBLIC_SXUA_ADDRESS;
  const portalAddress = process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL;

  if (!sxpAddress || !sxuaAddress) throw new Error("Missing addresses");

  const sxp = await ethers.getContractAt("SXP", sxpAddress);
  const owner = await sxp.owner();
  console.log("SXP Owner:", owner);
  console.log("SXUA Address:", sxuaAddress);
  
  if (owner.toLowerCase() !== sxuaAddress.toLowerCase()) {
    console.log("WARNING: SXUA is not the owner of SXP. Minting will fail!");
  } else {
    console.log("SUCCESS: SXUA owns SXP. Minting will work.");
  }

  // Also let's run the staticCall again now that stablecoin is supported!
  const portal = await ethers.getContractAt("BuyStablesPortal", portalAddress!);
  try {
    console.log("Attempting to simulate buyStables again...");
    await portal.buyStables.staticCall(0, 100, { value: ethers.parseEther("0.001") });
    console.log("Simulation SUCCESS! Transaction will work.");
  } catch (error: any) {
    console.error("Simulation REVERTED with error:", error.reason || error.message);
  }
}

main().catch(console.error);
