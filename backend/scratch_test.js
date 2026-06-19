const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const wallet = '0x1034aad10ef61534ea4df59cd040b3e4418c5e78';
  const deviceId = '0x3d510eb17d3ae486bcb725077f145f0b87054f2ced932891dfe025506f8c81da';

  try {
    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() }
    });

    console.log("User:", user);
    if (!user || !user.device_id) {
      console.log("No device registered");
      return;
    }

    console.log("Comparing:", user.device_id.toLowerCase(), "vs", deviceId.toLowerCase());
    if (user.device_id.toLowerCase() !== deviceId.toLowerCase()) {
      console.log("Mismatch");
    } else {
      console.log("Match!");
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
