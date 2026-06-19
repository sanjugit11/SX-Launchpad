import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer address (Admin 1):", deployer.address);

  const dmsAddress = process.env.NEXT_PUBLIC_DMS_VERIFIER_ADDRESS;
  const digAddress = process.env.NEXT_PUBLIC_DIG_MONITOR_ADDRESS;

  if (!dmsAddress || !digAddress) {
    throw new Error("Missing governance contract addresses in environment variable configuration");
  }

  console.log("DMSVerifier:", dmsAddress);
  console.log("DIGMonitor:", digAddress);

  const dmsVerifier = await ethers.getContractAt("DMSVerifier", dmsAddress);
  const digMonitor = await ethers.getContractAt("DIGMonitor", digAddress);

  // 1. Register Master Device for Admin 1
  const hash1 = ethers.keccak256(ethers.toUtf8Bytes("admin1_device"));
  console.log("Registering master device for Admin 1 with hash:", hash1);
  const txReg = await dmsVerifier.registerMasterDevice(hash1);
  await txReg.wait();
  console.log("Device registered successfully!");

  // 2. Create proposal on-chain
  const target = deployer.address;
  const calldata = "0x";
  console.log("Creating proposal on DIGMonitor...");
  const txCreate = await digMonitor.createProposal(target, calldata);
  const receiptCreate = await txCreate.wait();

  // Find ProposalCreated event
  let proposalId: bigint | undefined;
  for (const log of receiptCreate?.logs || []) {
    try {
      const parsed = digMonitor.interface.parseLog(log);
      if (parsed?.name === "ProposalCreated") {
        proposalId = parsed.args[0];
        break;
      }
    } catch (e) {}
  }

  if (proposalId === undefined) {
    throw new Error("Failed to find ProposalCreated event in receipt");
  }
  console.log("Created proposal with ID:", proposalId.toString());

  // 3. Approve proposal from Admin 1
  console.log("Approving proposal from Admin 1...");
  const txApprove1 = await digMonitor.approveProposal(proposalId, hash1, "0x");
  await txApprove1.wait();
  console.log("Admin 1 approved successfully!");

  // 4. Trigger backend mock approvals for Admin 2 & 3
  console.log(`Calling backend to mock approvals for proposal ${proposalId}...`);
  const resApprove = await fetch(`http://localhost:3001/api/admin/proposals/${proposalId}/mock-approve`, {
    method: "POST"
  });

  if (!resApprove.ok) {
    const errText = await resApprove.text();
    throw new Error(`Backend mock-approve failed: ${errText}`);
  }

  const approveResult = await resApprove.json();
  console.log("Backend response:", approveResult);

  // 5. Poll backend Proposals API to verify indexing
  console.log("Polling backend proposals list to verify indexing...");
  for (let i = 0; i < 10; i++) {
    const resList = await fetch("http://localhost:3001/api/admin/proposals");
    if (resList.ok) {
      const list = await resList.json();
      const found = list.find((p: any) => p.id === Number(proposalId));
      if (found) {
        console.log(`[Attempt ${i + 1}] Found proposal:`, found);
        if (found.executed && found.approvalCount === 3) {
          console.log("SUCCESS: Proposal is fully executed and has 3/3 approvals!");
          return;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error("Timed out waiting for backend indexer to process proposal approvals and execution");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
