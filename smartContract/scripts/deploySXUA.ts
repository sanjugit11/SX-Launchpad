import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      console.log(`Attempt ${i + 1} failed:`, e.message);
      if (i === retries - 1) throw e;
      await sleep(delay);
    }
  }
  throw new Error("Retry failed");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n=========================================`);
  console.log(`Deploying SXUA to: ${network.name}`);
  console.log(`Deployer Account: ${deployer.address}`);
  console.log(`=========================================\n`);

  // 1. Resolve SXP Reward Token Address
  let sxpAddress:any = process.env.NEXT_PUBLIC_SXP_ADDRESS;
  if (!sxpAddress || sxpAddress === "" || sxpAddress === ethers.ZeroAddress) {
    console.log("No SXP address found in .env, deploying Mock SXP...");
    const SXP = await ethers.getContractFactory("SXP");
    const sxp = await retry(() => SXP.deploy());
    await retry(() => sxp.waitForDeployment());
    sxpAddress = await sxp.getAddress();
    console.log(`Mock SXP deployed at: ${sxpAddress}`);
  } else {
    console.log(`Using existing SXP address: ${sxpAddress}`);
  }

  // 2. Deploy SXUA
  console.log("Deploying SXUA...");
  const SXUA = await ethers.getContractFactory("SXUA");
  
  // Use deployer address for system components
  const sxmmAddress = deployer.address;
  const ptfFeeAddress = deployer.address;
  const withdrawalFeeAddress = deployer.address;

  const sxua = await retry(() =>
    SXUA.deploy(sxpAddress, sxmmAddress, ptfFeeAddress, withdrawalFeeAddress)
  );
  await retry(() => sxua.waitForDeployment());
  const sxuaAddress = await sxua.getAddress();
  console.log(`SXUA successfully deployed at: ${sxuaAddress}`);
  
  // 3. Grant minter role to SXUA on SXP (if SXP is ownable/minter configurable)
  try {
    const SXP = await ethers.getContractFactory("SXP");
    const sxpInstance = SXP.attach(sxpAddress) as any;
    console.log("Authorizing SXUA as minter on SXP...");
    const tx = (await retry(() => sxpInstance.setMinter(sxuaAddress, true))) as any;
    await tx.wait();
    console.log("SXUA set as minter successfully.");
  } catch (error: any) {
    console.log("Non-blocking warning: Could not set minter role on SXP:", error.message);
  }

  // 4. Update the project-wide .env file
  const envPath = path.join(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");

    const updates = [
      { key: "NEXT_PUBLIC_SXP_ADDRESS", val: sxpAddress },
      { key: "NEXT_PUBLIC_SXUA_ADDRESS", val: sxuaAddress },
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
    console.log("Updated .env file with new SXUA/SXP addresses.");
  }

  console.log(`\nDeployment Complete!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
