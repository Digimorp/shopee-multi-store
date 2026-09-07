-- CreateTable
CREATE TABLE "status_mappings" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" "OrderStatus" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "status_mappings_pattern_key" ON "status_mappings"("pattern");
