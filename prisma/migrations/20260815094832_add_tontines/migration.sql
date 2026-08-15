-- CreateEnum
CREATE TYPE "TontineCycleStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('A_COLLECTER', 'COLLECTE', 'MANQUE');

-- CreateTable
CREATE TABLE "tontine_cycles" (
    "id" TEXT NOT NULL,
    "cycleNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amountPerCollection" DECIMAL(15,2) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allowedWeekdays" INTEGER[],
    "status" "TontineCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "tontine_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tontine_collections" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "status" "CollectionStatus" NOT NULL DEFAULT 'A_COLLECTER',
    "transactionId" TEXT,
    "collectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tontine_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tontine_cycles_cycleNumber_key" ON "tontine_cycles"("cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tontine_collections_transactionId_key" ON "tontine_collections"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "tontine_collections_cycleId_scheduledDate_key" ON "tontine_collections"("cycleId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "tontine_cycles" ADD CONSTRAINT "tontine_cycles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tontine_cycles" ADD CONSTRAINT "tontine_cycles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tontine_collections" ADD CONSTRAINT "tontine_collections_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "tontine_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tontine_collections" ADD CONSTRAINT "tontine_collections_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tontine_collections" ADD CONSTRAINT "tontine_collections_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE SEQUENCE IF NOT EXISTS tontine_cycle_number_seq START 1;