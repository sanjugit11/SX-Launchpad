-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "sxse_registered" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommittedSubAccount" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "yield" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlock_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommittedSubAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchpadPurchase" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "lt_amount" DOUBLE PRECISION NOT NULL,
    "claimed_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cliff_end" TIMESTAMP(3) NOT NULL,
    "vesting_end" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "phase" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,

    CONSTRAINT "LaunchpadPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellingListing" (
    "id" TEXT NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "seller_wallet" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchased_at" TIMESTAMP(3),

    CONSTRAINT "ResellingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOwnership" (
    "id" TEXT NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "owner_wallet" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vesting_end" TIMESTAMP(3) NOT NULL,
    "cliff_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrer" TEXT NOT NULL,
    "referee" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardCache" (
    "wallet" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeaderboardCache_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "contract" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "block_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedBlock" (
    "block_number" INTEGER NOT NULL,
    "block_hash" TEXT NOT NULL,

    CONSTRAINT "ProcessedBlock_pkey" PRIMARY KEY ("block_number")
);

-- CreateTable
CREATE TABLE "SyncStatus" (
    "chain_id" INTEGER NOT NULL,
    "last_block" INTEGER NOT NULL,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("chain_id")
);

-- CreateTable
CREATE TABLE "ReorgLog" (
    "id" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "ReorgLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexingError" (
    "id" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "block" INTEGER NOT NULL,

    CONSTRAINT "IndexingError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JailbreakAttempt" (
    "id" TEXT NOT NULL,
    "wallet" TEXT,
    "ip" TEXT,
    "pattern" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JailbreakAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "approvalCount" INTEGER NOT NULL DEFAULT 0,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommittedSubAccount" ADD CONSTRAINT "CommittedSubAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchpadPurchase" ADD CONSTRAINT "LaunchpadPurchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referee_fkey" FOREIGN KEY ("referee") REFERENCES "User"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;
