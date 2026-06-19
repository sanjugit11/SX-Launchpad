import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Contract Interfaces for log parsing
const SXUAInterface = new ethers.Interface([
  "event Deposited(address indexed user, uint256 subAccountId, uint256 amount, address token)",
  "event Withdrawn(address indexed user, uint256 subAccountId, uint256 amount)",
  "event YieldAccrued(address indexed user, uint256 subAccountId, uint256 yieldAmount)",
  "event PenaltyApplied(address indexed user, uint256 subAccountId, uint256 penaltyAmount)",
  "event PTFCollected(address indexed user, uint256 amount)"
]);

const BuyStablesInterface = new ethers.Interface([
  "event StablesPurchased(address indexed user, uint256 ethAmount, uint256 usdcAmount)",
  "event SXSERegistered(address indexed user, bool status)"
]);

const LaunchpadCoreInterface = new ethers.Interface([
  "event TokensPurchased(uint256 indexed purchaseId, address indexed user, uint256 amount)",
  "event VestedTokensClaimed(uint256 indexed purchaseId, address indexed user, uint256 amount)",
  "event TokensConvertedToMP(address indexed user, uint256 amount)",
  "event ForfeitureExecuted(uint256 indexed purchaseId, address indexed user, uint256 forfeitedAmount)",
  "event MintingCostPaid(uint256 indexed purchaseId, address indexed user, uint256 feeAmount)"
]);

const MarketplaceInterface = new ethers.Interface([
  "event TokensListed(uint256 indexed listingId, address indexed seller, uint256 amount, uint256 price)",
  "event TokensCancelled(uint256 indexed listingId)",
  "event TokensPurchased(uint256 indexed listingId, address indexed buyer, uint256 amount)"
]);

const ReferralInterface = new ethers.Interface([
  "event ReferralRegistered(address indexed referrer, string code)",
  "event ReferralCompleted(address indexed referrer, address indexed user, uint256 reward)"
]);

const DMSVerifierInterface = new ethers.Interface([
  "event MasterDeviceRegistered(address indexed admin, bytes32 deviceHash)",
  "event DeviceDeactivated(address indexed admin)"
]);

const DIGMonitorInterface = new ethers.Interface([
  "event KillSwitchActivated(address indexed admin)",
  "event KillSwitchDeactivated(address indexed admin)",
  "event Paused()",
  "event Unpaused()",
  "event ProposalCreated(uint256 indexed id, address target, bytes data)",
  "event ProposalApproved(uint256 indexed id, address indexed admin, uint8 approvalCount)",
  "event ProposalExecuted(uint256 indexed id)"
]);

const contractInterfaces: Record<string, ethers.Interface> = {
  SXUA: SXUAInterface,
  BuyStables: BuyStablesInterface,
  LaunchpadCore: LaunchpadCoreInterface,
  Marketplace: MarketplaceInterface,
  Referral: ReferralInterface,
  DMSVerifier: DMSVerifierInterface,
  DIGMonitor: DIGMonitorInterface
};

export class EventIndexer {
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private isRunning: boolean = false;

  constructor(rpcUrl: string, chainId: number) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
    this.chainId = chainId;
  }

  private getContracts() {
    return [
      { name: 'SXUA', address: (process.env.NEXT_PUBLIC_SXUA_ADDRESS || '0x356703658dEC72BD3dfeFbA9074351331d809B58').toLowerCase() },
      { name: 'BuyStables', address: (process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL || '0xE7e06eA25ddfB1B1dB071F6B61381AC439384E64').toLowerCase() },
      { name: 'LaunchpadCore', address: (process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS || '0x1163eC763Dcc6D74446618b35AEE1a161bB6c207').toLowerCase() },
      { name: 'Marketplace', address: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || '0xE24eB94257D780fe260D5DC0272767421f20EE68').toLowerCase() },
      { name: 'Referral', address: (process.env.NEXT_PUBLIC_REFERRAL_ADDRESS || '0x1560D05651123e7A45Fde0c29F1C2f2741D634a5').toLowerCase() },
      { name: 'DMSVerifier', address: (process.env.NEXT_PUBLIC_DMS_VERIFIER_ADDRESS || '0xEF9BB25ab3Af9428437CCd1fFbC59440dDA2BDb8').toLowerCase() },
      { name: 'DIGMonitor', address: (process.env.NEXT_PUBLIC_DIG_MONITOR_ADDRESS || '0x471ab7A7Ce30375e88a79fF3f4aB075EF05c2f5c').toLowerCase() }
    ];
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`Starting Event Indexer for Chain ID: ${this.chainId}`);
    this.scanLoop();
  }

  private async scanLoop() {
    while (this.isRunning) {
      try {
        const syncStatus = await prisma.syncStatus.findUnique({ where: { chain_id: this.chainId } });
        const latestBlock = await this.provider.getBlockNumber();
        
        let currentBlock = syncStatus ? syncStatus.last_block : latestBlock - 100;
        if (currentBlock < 0) currentBlock = 0;

        // Target up to 100 blocks at a time
        const targetBlock = Math.min(currentBlock + 100, latestBlock);

        if (currentBlock < targetBlock) {
          await this.processBlocks(currentBlock + 1, targetBlock);
        } else {
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        console.error("Indexing Loop Error:", error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  private async processBlocks(fromBlock: number, toBlock: number) {
    console.log(`Scanning blocks ${fromBlock} to ${toBlock}...`);

    for (let current = fromBlock; current <= toBlock; current++) {
      if (!this.isRunning) return;

      // 1. Get block header for parent hash check
      const block = await this.provider.getBlock(current);
      if (!block) {
        throw new Error(`Failed to fetch block header for block ${current}`);
      }

      // 2. Reorg check: parentHash of current must equal stored hash of current - 1
      if (current > 1) {
        const prevBlockRecord = await prisma.processedBlock.findUnique({
          where: { block_number: current - 1 }
        });

        if (prevBlockRecord && prevBlockRecord.block_hash !== block.parentHash) {
          console.warn(`[REORG DETECTED] at block ${current}. Expected parentHash ${prevBlockRecord.block_hash}, got ${block.parentHash}`);
          await this.handleReorg(current - 1);
          return; // Restart processing from scanLoop
        }
      }

      // 3. Process logs in this block
      const contracts = this.getContracts();
      for (const contract of contracts) {
        try {
          const logs = await this.provider.getLogs({
            address: contract.address,
            fromBlock: current,
            toBlock: current
          });

          for (const log of logs) {
            await this.processAndSaveEvent(contract.name, log, current);
          }
        } catch (error: any) {
          console.error(`Failed to fetch logs for ${contract.name} at block ${current}:`, error.message);
          await prisma.indexingError.create({
            data: {
              error: error.message,
              block: current
            }
          });
        }
      }

      // 4. Save to ProcessedBlock
      await prisma.processedBlock.upsert({
        where: { block_number: current },
        update: { block_hash: block.hash || "" },
        create: { block_number: current, block_hash: block.hash || "" }
      });

      // 5. Update Checkpoint
      await prisma.syncStatus.upsert({
        where: { chain_id: this.chainId },
        update: { last_block: current },
        create: { chain_id: this.chainId, last_block: current }
      });
    }
  }

  private async processAndSaveEvent(contractName: string, log: ethers.Log, blockNumber: number) {
    const iface = contractInterfaces[contractName];
    let eventName = "Unknown";
    let parsedPayload: any = {};

    if (iface) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          eventName = parsed.name;
          parsedPayload = JSON.parse(
            JSON.stringify(parsed.args, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            )
          );
        }
      } catch (err: any) {
        eventName = log.topics[0] || "Unknown";
      }
    }

    // Save standard Event log
    await prisma.event.create({
      data: {
        chain_id: this.chainId,
        contract: contractName,
        event_name: eventName,
        tx_hash: log.transactionHash,
        block_number: blockNumber,
        block_hash: log.blockHash || "",
        payload: {
          args: parsedPayload,
          log: {
            address: log.address,
            data: log.data,
            topics: log.topics,
            transactionHash: log.transactionHash,
            blockHash: log.blockHash,
            blockNumber: log.blockNumber,
            index: log.index
          }
        }
      }
    });

    // Custom State-Updating Handlers
    const logAddress = log.address.toLowerCase();

    // 1. Referral events
    if (contractName === 'Referral') {
      try {
        if (eventName === 'ReferralRegistered') {
          const referrer = parsedPayload[0].toLowerCase();
          await prisma.user.upsert({
            where: { wallet: referrer },
            update: {},
            create: { wallet: referrer }
          });
        } else if (eventName === 'ReferralCompleted') {
          const referrer = parsedPayload[0].toLowerCase();
          const referee = parsedPayload[1].toLowerCase();

          await prisma.user.upsert({ where: { wallet: referrer }, update: {}, create: { wallet: referrer } });
          await prisma.user.upsert({ where: { wallet: referee }, update: {}, create: { wallet: referee } });

          const existing = await prisma.referral.findFirst({ where: { referrer, referee } });
          if (!existing) {
            await prisma.referral.create({
              data: { referrer, referee, status: 'PENDING', rewarded: false }
            });
          }
        }
      } catch (err: any) {
        console.error("Referral indexer processing error:", err.message);
      }
    }

    // 2. SXUA deposits
    if (contractName === 'SXUA') {
      try {
        if (eventName === 'Deposited') {
          const referee = parsedPayload[0].toLowerCase();
          const amountRaw = parsedPayload[2];
          const amount = parseFloat(ethers.formatUnits(amountRaw, 18));

          const refereeUser = await prisma.user.upsert({
            where: { wallet: referee },
            update: {},
            create: { wallet: referee }
          });

          await prisma.transaction.create({
            data: {
              user_id: refereeUser.id,
              type: 'DEPOSIT',
              amount,
              tx_hash: log.transactionHash,
              status: 'SUCCESS'
            }
          });

          // Check if referee has pending referral and deposited >= 500 USDC
          if (amount >= 500) {
            const pendingReferrals = await prisma.referral.findMany({
              where: { referee, status: 'PENDING' }
            });

            for (const ref of pendingReferrals) {
              await prisma.referral.update({
                where: { id: ref.id },
                data: { status: 'SUCCESS', rewarded: true }
              });

              await prisma.leaderboardCache.upsert({
                where: { wallet: ref.referrer },
                update: { count: { increment: 1 } },
                create: { wallet: ref.referrer, count: 1 }
              });
            }
          }
        }
      } catch (err: any) {
        console.error("SXUA indexer processing error:", err.message);
      }
    }

    // 3. BuyStables events
    if (contractName === 'BuyStables') {
      try {
        if (eventName === 'StablesPurchased') {
          const userWallet = parsedPayload[0].toLowerCase();
          const usdcAmountRaw = parsedPayload[2];
          const usdcAmount = parseFloat(ethers.formatUnits(usdcAmountRaw, 18));

          const user = await prisma.user.upsert({
            where: { wallet: userWallet },
            update: {},
            create: { wallet: userWallet }
          });

          await prisma.transaction.create({
            data: {
              user_id: user.id,
              type: 'BUY_STABLES',
              amount: usdcAmount,
              tx_hash: log.transactionHash,
              status: 'SUCCESS'
            }
          });
        } else if (eventName === 'SXSERegistered') {
          const userWallet = parsedPayload[0].toLowerCase();
          const status = parsedPayload[1];

          await prisma.user.upsert({
            where: { wallet: userWallet },
            update: { sxse_registered: status },
            create: { wallet: userWallet, sxse_registered: status }
          });
        }
      } catch (err: any) {
        console.error("BuyStables indexer processing error:", err.message);
      }
    }

    // 4. DMSVerifier events
    if (contractName === 'DMSVerifier') {
      try {
        if (eventName === 'MasterDeviceRegistered') {
          const admin = parsedPayload[0].toLowerCase();
          const deviceHash = parsedPayload[1];

          await prisma.user.upsert({
            where: { wallet: admin },
            update: { device_id: deviceHash },
            create: { wallet: admin, device_id: deviceHash }
          });
        }
      } catch (err: any) {
        console.error("DMSVerifier indexer processing error:", err.message);
      }
    }

    // 5. DIGMonitor events
    if (contractName === 'DIGMonitor') {
      try {
        if (eventName === 'ProposalCreated') {
          const id = Number(parsedPayload[0]);
          const target = parsedPayload[1].toLowerCase();
          const data = parsedPayload[2];

          await prisma.proposal.upsert({
            where: { id },
            update: { target, data },
            create: { id, target, data, approvalCount: 0, executed: false }
          });
        } else if (eventName === 'ProposalApproved') {
          const id = Number(parsedPayload[0]);
          const approvalCount = Number(parsedPayload[2]);

          await prisma.proposal.update({
            where: { id },
            data: { approvalCount }
          });
        } else if (eventName === 'ProposalExecuted') {
          const id = Number(parsedPayload[0]);

          await prisma.proposal.update({
            where: { id },
            data: { executed: true, approvalCount: 3 }
          });
        } else if (eventName === 'KillSwitchActivated') {
          const admin = parsedPayload[0].toLowerCase();
          await prisma.adminAction.create({
            data: { admin, action: "ACTIVATE_KILL_SWITCH" }
          });
        } else if (eventName === 'KillSwitchDeactivated') {
          const admin = parsedPayload[0].toLowerCase();
          await prisma.adminAction.create({
            data: { admin, action: "DEACTIVATE_KILL_SWITCH" }
          });
        }
      } catch (err: any) {
        console.error("DIGMonitor indexer processing error:", err.message);
      }
    }

    // 6. LaunchpadCore events
    if (contractName === 'LaunchpadCore') {
      try {
        if (eventName === 'TokensPurchased') {
          const purchaseId = Number(parsedPayload[0]);
          const userWallet = parsedPayload[1].toLowerCase();
          const amountRaw = parsedPayload[2];
          const amount = parseFloat(ethers.formatUnits(amountRaw, 18));

          const user = await prisma.user.upsert({
            where: { wallet: userWallet },
            update: {},
            create: { wallet: userWallet }
          });

          await prisma.launchpadPurchase.upsert({
            where: { id: purchaseId },
            update: { status: 'VESTING' },
            create: {
              id: purchaseId,
              user_id: user.id,
              lt_amount: amount,
              claimed_amount: 0,
              cliff_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              vesting_end: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
              status: 'VESTING'
            }
          });
        } else if (eventName === 'VestedTokensClaimed') {
          const purchaseId = Number(parsedPayload[0]);
          const amountRaw = parsedPayload[2];
          const amount = parseFloat(ethers.formatUnits(amountRaw, 18));

          await prisma.launchpadPurchase.update({
            where: { id: purchaseId },
            data: {
              claimed_amount: { increment: amount },
              claimed_at: new Date(),
              status: 'CLAIMED'
            }
          });
        } else if (eventName === 'ForfeitureExecuted') {
          const purchaseId = Number(parsedPayload[0]);

          await prisma.launchpadPurchase.update({
            where: { id: purchaseId },
            data: { status: 'FORFEITED' }
          });
        }
      } catch (err: any) {
        console.error("LaunchpadCore indexer processing error:", err.message);
      }
    }

    // 7. Marketplace events
    if (contractName === 'Marketplace') {
      try {
        if (eventName === 'TokensListed') {
          const listingId = Number(parsedPayload[0]);
          const seller = parsedPayload[1].toLowerCase();
          const amount = parseFloat(ethers.formatUnits(parsedPayload[2], 18));
          const price = parseFloat(ethers.formatUnits(parsedPayload[3], 18));

          await prisma.resellingListing.upsert({
            where: { id: listingId.toString() },
            update: { status: 'ACTIVE', amount, price },
            create: {
              id: listingId.toString(),
              purchase_id: 0,
              seller_wallet: seller,
              amount,
              price,
              status: 'ACTIVE'
            }
          });
        } else if (eventName === 'TokensCancelled') {
          const listingId = Number(parsedPayload[0]);

          await prisma.resellingListing.update({
            where: { id: listingId.toString() },
            data: { status: 'CANCELLED' }
          });
        } else if (eventName === 'TokensPurchased') {
          const listingId = Number(parsedPayload[0]);

          await prisma.resellingListing.update({
            where: { id: listingId.toString() },
            data: { status: 'SOLD', purchased_at: new Date() }
          });
        }
      } catch (err: any) {
        console.error("Marketplace indexer processing error:", err.message);
      }
    }
  }

  private async handleReorg(lastValidBlock: number) {
    console.log(`[Reorg Handler] Rolling back state to block ${lastValidBlock}`);

    let rollbackBlock = lastValidBlock;
    while (rollbackBlock > 0) {
      const block = await this.provider.getBlock(rollbackBlock);
      const stored = await prisma.processedBlock.findUnique({
        where: { block_number: rollbackBlock }
      });

      if (!block || !stored) {
        rollbackBlock--;
        continue;
      }

      if (block.hash === stored.block_hash) {
        break;
      }
      rollbackBlock--;
    }

    console.log(`[Reorg Handler] Last common block found at: ${rollbackBlock}`);

    await prisma.reorgLog.create({
      data: {
        block: lastValidBlock,
        action: `ROLLBACK_TO_${rollbackBlock}`
      }
    });

    const deleteEvents = await prisma.event.deleteMany({
      where: {
        chain_id: this.chainId,
        block_number: { gt: rollbackBlock }
      }
    });
    console.log(`[Reorg Handler] Deleted ${deleteEvents.count} events`);

    const deleteBlocks = await prisma.processedBlock.deleteMany({
      where: {
        block_number: { gt: rollbackBlock }
      }
    });
    console.log(`[Reorg Handler] Deleted ${deleteBlocks.count} processed blocks cache`);

    await prisma.syncStatus.upsert({
      where: { chain_id: this.chainId },
      update: { last_block: rollbackBlock },
      create: { chain_id: this.chainId, last_block: rollbackBlock }
    });
  }

  public stop() {
    this.isRunning = false;
  }
}
