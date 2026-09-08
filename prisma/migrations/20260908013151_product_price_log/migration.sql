-- CreateTable
CREATE TABLE "product_price_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oldHpp" DOUBLE PRECISION NOT NULL,
    "newHpp" DOUBLE PRECISION NOT NULL,
    "oldCatalog" DOUBLE PRECISION NOT NULL,
    "newCatalog" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_price_logs_productId_createdAt_idx" ON "product_price_logs"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "product_price_logs" ADD CONSTRAINT "product_price_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_logs" ADD CONSTRAINT "product_price_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
