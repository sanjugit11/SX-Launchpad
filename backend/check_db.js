const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users);
  const purchases = await prisma.launchpadPurchase.findMany();
  console.log("Purchases:", purchases);
}
main().catch(console.error).finally(() => prisma.$disconnect());
