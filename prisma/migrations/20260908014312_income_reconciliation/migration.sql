-- CreateEnum
CREATE TYPE "IncomeEntryType" AS ENUM ('ORDER', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "settlementDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "income_imports" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "orderRows" INTEGER NOT NULL DEFAULT 0,
    "adjustmentRows" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "IncomeEntryType" NOT NULL,
    "orderSn" TEXT,
    "adjustmentKind" TEXT,
    "description" TEXT,
    "releasedAt" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "income_imports_storeId_isSuperseded_idx" ON "income_imports"("storeId", "isSuperseded");

-- CreateIndex
CREATE INDEX "income_entries_storeId_orderSn_idx" ON "income_entries"("storeId", "orderSn");

-- CreateIndex
CREATE INDEX "income_entries_importId_idx" ON "income_entries"("importId");

-- AddForeignKey
ALTER TABLE "income_imports" ADD CONSTRAINT "income_imports_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_imports" ADD CONSTRAINT "income_imports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_importId_fkey" FOREIGN KEY ("importId") REFERENCES "income_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
