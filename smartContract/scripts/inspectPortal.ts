import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const portalAddress = process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL;
  if (!portalAddress) throw new Error("Missing portal address");

  const portal = await ethers.getContractAt("BuyStablesPortal", portalAddress);
  
  const routerAddress = await portal.sxcpRouter();
  const usdcAddress = await portal.usdcToken();
  const sxuaAddress = await portal.sxuaContract();
  const treasuryAddress = await portal.treasury();

  console.log("Portal Address:", portalAddress);
  console.log("Router Address:", routerAddress);
  console.log("USDC Address:", usdcAddress);
  console.log("SXUA Address:", sxuaAddress);
  console.log("Treasury Address:", treasuryAddress);

  const isRegistered = await portal.isSXSE(deployer.address);
  console.log("Is Deployer Registered in Portal?", isRegistered);

  // Check balances
  const usdc = await ethers.getContractAt("SXP", usdcAddress); // USDC is SXP token mock
  const routerUsdcBal = await usdc.balanceOf(routerAddress);
  const portalUsdcBal = await usdc.balanceOf(portalAddress);
  console.log("Router USDC Balance:", ethers.formatEther(routerUsdcBal));
  console.log("Portal USDC Balance:", ethers.formatEther(portalUsdcBal));

  // Let's call the router directly to see if WETH and swap works
  const router = await ethers.getContractAt("MockRouter", routerAddress);
  try {
    const weth = await router.WETH();
    console.log("Router WETH:", weth);
  } catch (e: any) {
    console.log("Failed to call router.WETH():", e.message);
  }

  // Let's run a simulation of the buyStables call
  try {
    console.log("Simulating buyStables(0, 100)...");
    const tx = await portal.buyStables.staticCall(0, 100, { value: ethers.parseEther("0.001") });
    console.log("Simulation succeeded!");
  } catch (error: any) {
    console.log("Simulation failed!");
    if (error.data) {
      console.log("Error data:", error.data);
    }
    console.log("Error message:", error.message);
  }
}

main().catch(console.error);
