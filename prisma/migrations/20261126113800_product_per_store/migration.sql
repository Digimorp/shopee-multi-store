-- T-013 batch 21: Produk & HPP milik tiap toko.
-- storeId NULL = produk lama global (warisan), dipakai hanya sebagai cadangan pencocokan upload.
-- Tanpa backfill otomatis; tidak ada data yang dihapus.

-- DropIndex
DROP INDEX "products_sku_key";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "storeId" TEXT;

-- CreateIndex
CREATE INDEX "products_storeId_idx" ON "products"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "products_storeId_sku_key" ON "products"("storeId", "sku");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
