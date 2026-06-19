import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  const sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS;
  if (!usdcAddress || !sxpAddress) throw new Error("Missing addresses in env");

  const usdc = await ethers.getContractAt("SXP", usdcAddress);
  const sxp = await ethers.getContractAt("SXP", sxpAddress);

  // 1. Deploy new SXUA
  console.log("Deploying new SXUA...");
  const SXUA = await ethers.getContractFactory("SXUA");
  const sxua = await SXUA.deploy(sxpAddress, deployer.address, deployer.address, deployer.address);
  await sxua.waitForDeployment();
  const newSxuaAddress = await sxua.getAddress();
  console.log("New SXUA deployed to:", newSxuaAddress);

  // 2. Authorize new SXUA as minter on SXP
  console.log("Authorizing new SXUA as minter on SXP...");
  const txMin = await sxp.setMinter(newSxuaAddress, true);
  await txMin.wait();

  // 3. Register USDC in new SXUA
  console.log("Registering USDC in new SXUA...");
  const txAdd = await sxua.addSupportedStable(usdcAddress, 18);
  await txAdd.wait();

  // 4. Deploy MockRouter
  console.log("Deploying MockRouter...");
  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = await MockRouter.deploy(usdcAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("MockRouter deployed to:", routerAddress);

  // Fund router with USDC
  console.log("Funding MockRouter with 10,000 USDC...");
  const txFund = await usdc.mint(routerAddress, ethers.parseEther("10000"));
  await txFund.wait();

  // 5. Deploy BuyStablesPortal
  console.log("Deploying BuyStablesPortal...");
  const BuyStablesPortal = await ethers.getContractFactory("BuyStablesPortal");
  const portal = await BuyStablesPortal.deploy(newSxuaAddress, routerAddress, usdcAddress, deployer.address);
  await portal.waitForDeployment();
  const portalAddress = await portal.getAddress();
  console.log("BuyStablesPortal deployed to:", portalAddress);

  // 6. Register deployer in Portal
  console.log("Registering deployer in Portal...");
  const txReg = await portal.registerSXSE(deployer.address, true);
  await txReg.wait();

  // 7. Update .env file
  const envPath = path.resolve(__dirname, "../../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  
  const updates = [
    { key: "NEXT_PUBLIC_SXUA_ADDRESS", val: newSxuaAddress },
    { key: "NEXT_PUBLIC_BUY_STABLES_PORTAL", val: portalAddress }
  ];

  for (const item of updates) {
    const regex = new RegExp(`${item.key}=.*`);
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${item.key}="${item.val}"`);
    } else {
      envContent += `\n${item.key}="${item.val}"\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("\n🎉 Redeployment complete and .env updated successfully!");
  console.log(`New SXUA Address: ${newSxuaAddress}`);
  console.log(`New BuyStablesPortal Address: ${portalAddress}`);
}

main().catch(console.error);
