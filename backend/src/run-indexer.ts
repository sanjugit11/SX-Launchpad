import dotenv from 'dotenv';
import path from 'path';
import { EventIndexer } from './indexer/indexer.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const RPC_URL = process.env.HOODI_RPC_URL || process.env.RPC_URL || 'https://hoodi.drpc.org';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '560048');

async function main() {
  console.log("Initializing Event Indexer Service...");
  const indexer = new EventIndexer(RPC_URL, CHAIN_ID);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log("Stopping Indexer...");
    indexer.stop();
    process.exit(0);
  });

  await indexer.start();
}

main().catch(console.error);
