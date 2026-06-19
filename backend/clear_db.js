const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.launchpadPurchase.deleteMany();
  console.log("Cleared LaunchpadPurchase table!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
