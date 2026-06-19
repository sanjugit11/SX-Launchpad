import { run, ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function verifyContract(address: string, contractPath: string, args: any[]) {
  console.log(`\n-----------------------------------------`);
  console.log(`Verifying: ${contractPath}`);
  console.log(`Address: ${address}`);
  console.log(`Args:`, args);
  console.log(`-----------------------------------------`);

  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: args,
      contract: contractPath,
    });
    console.log(`Successfully verified ${contractPath}`);
  } catch (error: any) {
    if (
      error.message.includes("Already Verified") ||
      error.message.includes("already verified")
    ) {
      console.log(`Already verified: ${contractPath}`);
    } else {
      console.log(`Verification failed for ${contractPath}:`, error.message);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n=========================================`);
  console.log(`Verifying Contracts on Network: ${network.name}`);
  console.log(`Using account: ${deployer.address}`);
  console.log(`=========================================\n`);

  // 1. Verify SXP Token (all networks)
  // const sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS;
  // if (sxpAddress && sxpAddress !== ethers.ZeroAddress) {
  //   await verifyContract(sxpAddress, "contracts/core/SXP.sol:SXP", []);
  // }

  // 2. Verify SXUA (all networks)
  // const sxuaAddress = process.env.NEXT_PUBLIC_SXUA_ADDRESS;
  const sxuaAddress = "0x462BE7Aae2B2f8a731dA4b07baa7325986FD828a";

  if (sxuaAddress && sxuaAddress !== ethers.ZeroAddress) {
    try {
      const sxua = await ethers.getContractAt("SXUA", sxuaAddress);
      const sxpToken = await sxua.sxpToken();
      const sxmmAddress = await sxua.sxmmAddress();
      const ptfFeeAddress = await sxua.ptfFeeAddress();
      const withdrawalFeeAddress = await sxua.withdrawalFeeAddress();
      
      await verifyContract(sxuaAddress, "contracts/core/SXUA.sol:SXUA", [
        sxpToken,
        sxmmAddress,
        ptfFeeAddress,
        withdrawalFeeAddress,
      ]);
    } catch (e: any) {
      console.log("Failed to query SXUA parameters:", e.message);
    }
  }

  // Verification steps limited to Hoodi network
  if (network.name === "hoodi") {
    // 3. Verify DMSVerifier
    const dmsVerifierAddress = process.env.NEXT_PUBLIC_DMS_VERIFIER_ADDRESS;
    if (dmsVerifierAddress && dmsVerifierAddress !== ethers.ZeroAddress) {
      await verifyContract(
        dmsVerifierAddress,
        "contracts/governance/DMSVerifier.sol:DMSVerifier",
        []
      );
    }

    // 4. Verify DIGMonitor
    const digMonitorAddress = process.env.NEXT_PUBLIC_DIG_MONITOR_ADDRESS;
    if (digMonitorAddress && digMonitorAddress !== ethers.ZeroAddress) {
      try {
        const dig = await ethers.getContractAt("DIGMonitor", digMonitorAddress);
        const dms = await dig.dmsVerifier();
        const admin1 = await dig.admins(0);
        const admin2 = await dig.admins(1);
        const admin3 = await dig.admins(2);
        
        await verifyContract(
          digMonitorAddress,
          "contracts/governance/DIGMonitor.sol:DIGMonitor",
          [dms, admin1, admin2, admin3]
        );
      } catch (e: any) {
        console.log("Failed to query DIGMonitor parameters:", e.message);
      }
    }

    // 5. Verify FeeManager
    const feeManagerAddress = process.env.NEXT_PUBLIC_FEE_MANAGER_ADDRESS;
    if (feeManagerAddress && feeManagerAddress !== ethers.ZeroAddress) {
      await verifyContract(
        feeManagerAddress,
        "contracts/governance/FeeManager.sol:FeeManager",
        []
      );
    }

    // 6. Verify TimelockController
    const timelockAddress = process.env.NEXT_PUBLIC_TIMELOCK_CONTROLLER_ADDRESS;
    if (timelockAddress && timelockAddress !== ethers.ZeroAddress) {
      const minDelay = 300;
      const proposers = [deployer.address];
      const executors = [deployer.address];
      const admin = deployer.address;
      await verifyContract(
        timelockAddress,
        "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController",
        [minDelay, proposers, executors, admin]
      );
    }

    // 7. Verify LaunchpadCore
    const launchpadAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
    if (launchpadAddress && launchpadAddress !== ethers.ZeroAddress) {
      try {
        const launchpad = await ethers.getContractAt("LaunchpadCore", launchpadAddress);
        const paymentToken = await launchpad.paymentToken();
        const ltToken = await launchpad.ltToken();
        const mpToken = await launchpad.mpToken();
        const treasury = await launchpad.treasury();
        const tokenPrice = await launchpad.tokenPrice();
        
        await verifyContract(
          launchpadAddress,
          "contracts/core/LaunchpadCore.sol:LaunchpadCore",
          [paymentToken, ltToken, mpToken, treasury, tokenPrice]
        );
      } catch (e: any) {
        console.log("Failed to query LaunchpadCore parameters:", e.message);
      }
    }

    // 8. Verify Marketplace (ResellingMarketplace)
    const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
    if (marketplaceAddress && marketplaceAddress !== ethers.ZeroAddress) {
      try {
        const mp = await ethers.getContractAt("Marketplace", marketplaceAddress);
        const launchpadCore = await mp.launchpadCore();
        const paymentToken = await mp.paymentToken();
        
        await verifyContract(
          marketplaceAddress,
          "contracts/market/Marketplace.sol:Marketplace",
          [launchpadCore, paymentToken]
        );
      } catch (e: any) {
        console.log("Failed to query Marketplace parameters:", e.message);
      }
    }

    // 9. Verify BuyStablesPortal
    const portalAddress = process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL;
    if (portalAddress && portalAddress !== ethers.ZeroAddress) {
      try {
        const portal = await ethers.getContractAt("BuyStablesPortal", portalAddress);
        const sxua = await portal.sxuaContract();
        const sxcp = await portal.sxcpRouter();
        const usdc = await portal.usdcToken();
        const treasury = await portal.treasury();
        
        await verifyContract(
          portalAddress,
          "contracts/portal/BuyStablesPortal.sol:BuyStablesPortal",
          [sxua, sxcp, usdc, treasury]
        );
      } catch (e: any) {
        console.log("Failed to query BuyStablesPortal parameters:", e.message);
      }
    }

    // 10. Verify Referral
    const referralAddress = process.env.NEXT_PUBLIC_REFERRAL_ADDRESS;
    if (referralAddress && referralAddress !== ethers.ZeroAddress) {
      try {
        const ref = await ethers.getContractAt("Referral", referralAddress);
        const leaderboard = await ref.leaderboard();
        const rewardToken = await ref.rewardToken();
        
        await verifyContract(referralAddress, "contracts/social/Referral.sol:Referral", [
          leaderboard,
          rewardToken,
        ]);
      } catch (e: any) {
        console.log("Failed to query Referral parameters:", e.message);
      }
    }
  }

  console.log(`\nAll Verification actions completed!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
