import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ABI = [
  "function owner() view returns (address)",
  "function setMarketplaceAddress(address _marketplace) external",
  "function marketplaceAddress() view returns (address)"
];

async function main() {
  const launchpadAddress = "0x66244FB23187703C2641b0704fD708952C55cd14";
  const marketplaceAddress = "0x97a5ea46567781cA9D8CEa2F45D263FECcA40d18";
  const rpcUrl = process.env.RPC_URL || "https://rpc.hoodi.ethpandaops.io";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in .env");
  }

  console.log("Connecting to RPC:", rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Read using pure provider (no from address) to avoid nonce bug on eth_call
  const launchpadRead = new ethers.Contract(launchpadAddress, ABI, provider);
  const owner = await launchpadRead.owner();
  console.log("Contract owner:", owner);

  // Write using wallet
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Using sender address:", wallet.address);
  const launchpadWrite = new ethers.Contract(launchpadAddress, ABI, wallet);

  console.log("Setting marketplace address to:", marketplaceAddress);
  
  // Explicitly fetch the correct nonce to prevent any library/node desync
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log("Current pending nonce:", nonce);

  const tx = await launchpadWrite.setMarketplaceAddress(marketplaceAddress, { nonce });
  console.log("Tx hash sent:", tx.hash);
  await tx.wait();
  console.log("Successfully authorized marketplace on-chain!");

  const updatedMarketplace = await launchpadRead.marketplaceAddress();
  console.log("Updated marketplace address on contract:", updatedMarketplace);
}

main().catch(console.error);
