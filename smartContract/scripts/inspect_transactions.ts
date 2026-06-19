import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ABI = [
  "event TokensListed(uint256 indexed listingId, address indexed seller, uint256 amount, uint256 price)",
  "function nextListingId() view returns (uint256)",
  "function launchpadCore() view returns (address)"
];

async function main() {
  const marketplaceAddress = "0x97a5ea46567781cA9D8CEa2F45D263FECcA40d18";
  const rpcUrl = process.env.RPC_URL || "https://rpc.hoodi.ethpandaops.io";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const m = new ethers.Contract(marketplaceAddress, ABI, provider);

  const nextListingId = await m.nextListingId();
  console.log("Next Listing ID on Marketplace:", nextListingId.toString());

  const lpAddr = await m.launchpadCore();
  console.log("Configured LaunchpadCore address on Marketplace contract:", lpAddr);

  // Let's get the transaction count of the user to see their nonce
  const user = "0x1034aad10eF61534EA4Df59cd040b3e4418C5E78";
  const nonce = await provider.getTransactionCount(user);
  console.log("User nonce:", nonce);

  // Let's check the block number
  const blockNumber = await provider.getBlockNumber();
  console.log("Current block number:", blockNumber);

  // Fetch the user's last few transactions if possible, or query events
  const filter = m.filters.TokensListed();
  const events = await m.queryFilter(filter, blockNumber - 5000, blockNumber);
  console.log(`Found ${events.length} TokensListed events in the last 5000 blocks:`);
  for (const e of events) {
    if ('args' in e && e.args) {
      console.log(`Listing ID ${e.args[0]}: seller=${e.args[1]}, amount=${ethers.formatEther(e.args[2])}, price=${ethers.formatUnits(e.args[3], 18)}`);
    }
  }
}

main().catch(console.error);
