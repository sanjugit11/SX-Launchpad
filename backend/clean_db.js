const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.resellingListing.deleteMany();
  await prisma.marketplaceOwnership.deleteMany();
  await prisma.launchpadPurchase.deleteMany();
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "LaunchpadPurchase_id_seq" RESTART WITH 1;');
  console.log("Successfully wiped all Launchpad Purchases, Marketplace Listings, and Ownership records!");
  console.log("Purchase IDs have been reset to start at 1.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
