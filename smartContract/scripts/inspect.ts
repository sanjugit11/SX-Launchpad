import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ABI = [
  "function marketplaceAddress() view returns (address)",
  "function getUserPurchases(address user) view returns (uint256[])",
  "function purchases(uint256) view returns (address user, uint256 amountLT, uint256 claimedAmount, uint256 purchaseTime, uint256 cliffEnd, uint256 vestingEnd, uint256 phase, bool isActive)"
];

async function main() {
  const user = "0x1034aad10eF61534EA4Df59cd040b3e4418C5E78";
  const launchpadAddress = "0x66244FB23187703C2641b0704fD708952C55cd14";
  const rpcUrl = process.env.RPC_URL || "https://rpc.hoodi.ethpandaops.io";

  console.log("Connecting to RPC:", rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const launchpad = new ethers.Contract(launchpadAddress, ABI, provider);

  const mAddr = await launchpad.marketplaceAddress();
  console.log("Configured marketplace address on LaunchpadCore:", mAddr);

  const purchaseIds = await launchpad.getUserPurchases(user);
  console.log("User purchases IDs:", purchaseIds.map((id: any) => id.toString()));

  for (const id of purchaseIds) {
    const p = await launchpad.purchases(id);
    console.log(`Purchase ID ${id}:`, {
      user: p.user,
      amountLT: ethers.formatEther(p.amountLT),
      claimedAmount: ethers.formatEther(p.claimedAmount),
      isActive: p.isActive
    });
  }
}

main().catch(console.error);
