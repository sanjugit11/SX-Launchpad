const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const syncStatus = await prisma.syncStatus.findMany();
  console.log("SyncStatus:", syncStatus);

  const processedBlockCount = await prisma.processedBlock.count();
  console.log("ProcessedBlock Count:", processedBlockCount);

  const latestProcessed = await prisma.processedBlock.findMany({
    orderBy: { block_number: 'desc' },
    take: 5
  });
  console.log("Latest Processed Blocks:", latestProcessed);

  const eventCount = await prisma.event.count();
  console.log("Event Count:", eventCount);

  const latestEvents = await prisma.event.findMany({
    orderBy: { block_number: 'desc' },
    take: 5
  });
  console.log("Latest Events:", latestEvents);
}

main().catch(console.error).finally(() => prisma.$disconnect());
