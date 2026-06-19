import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const user = deployer.address;
  console.log("Checking transactions for user:", user);

  const nonce = await provider.getTransactionCount(user);
  console.log("Current nonce:", nonce);

  // Get block number
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Let's find the transaction with nonce = 249 or search the last 50 blocks
  // Wait, the Metamask notification says "Transaction 249 failed!"
  // Nonce could be 249. Let's scan blocks or just search for the transaction by scanning last blocks.
  // Actually, we can search for transactions in the last 100 blocks
  for (let b = latestBlock; b > latestBlock - 100 && b >= 0; b--) {
    const block = await provider.getBlock(b, true);
    if (!block) continue;
    for (const txHash of block.transactions) {
      const tx = await provider.getTransaction(txHash);
      if (tx && tx.from.toLowerCase() === user.toLowerCase()) {
        const receipt = await provider.getTransactionReceipt(txHash);
        console.log(`Block ${b} | Tx: ${txHash} | Nonce: ${tx.nonce} | To: ${tx.to} | Status: ${receipt?.status === 1 ? "SUCCESS" : "FAILED"}`);
        if (receipt?.status === 0) {
          console.log("Failed transaction details:", {
            to: tx.to,
            value: ethers.formatEther(tx.value),
            gasUsed: receipt.gasUsed.toString(),
          });
          // Try to simulate to get revert reason
          try {
            await provider.call({
              from: tx.from,
              to: tx.to,
              data: tx.data,
              value: tx.value,
              gasLimit: tx.gasLimit,
              blockTag: receipt.blockNumber - 1
            });
            console.log("Simulation succeeded at pre-tx block!");
          } catch (err: any) {
            console.log("Revert reason from simulation:", err.reason || err.message);
          }
        }
      }
    }
  }
}

main().catch(console.error);
