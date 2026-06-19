const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "LaunchpadPurchase_id_seq" RESTART WITH 1;');
  console.log("Reset sequence!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
