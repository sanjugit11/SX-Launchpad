import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ABI = [
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

async function main() {
  const usdcAddress = "0x45E37F08DEA749181e5f97628Dd7A0b985867826";
  const rpcUrl = process.env.RPC_URL || "https://rpc.hoodi.ethpandaops.io";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdc = new ethers.Contract(usdcAddress, ABI, provider);

  const name = await usdc.name();
  const symbol = await usdc.symbol();
  const decimals = await usdc.decimals();

  console.log(`USDC contract at ${usdcAddress}:`, { name, symbol, decimals });
}

main().catch(console.error);
