const { ethers } = require("ethers");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.hoodi.ethpandaops.io");
  const wallet = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, provider); // Wait, I don't know the private key...
}
