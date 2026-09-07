-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN_TOKO');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CANCEL', 'RETUR', 'TRANSIT', 'PENDING_SETTLEMENT', 'SELESAI');

-- CreateEnum
CREATE TYPE "ReturCondition" AS ENUM ('GOOD', 'DAMAGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "user_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hpp" DOUBLE PRECISION NOT NULL,
    "catalogPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_logs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "uploadLogId" TEXT NOT NULL,
    "orderSn" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "orderCreatedAt" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "returCondition" "ReturCondition",
    "grossOmzet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSettlement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hppSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catalogPriceSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitHpp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitAgen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodKey" TEXT NOT NULL,
    "rawRow" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_settings" (
    "id" TEXT NOT NULL,
    "cutoffDay" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_locks" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_stores_userId_storeId_key" ON "user_stores"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "orders_storeId_status_idx" ON "orders"("storeId", "status");

-- CreateIndex
CREATE INDEX "orders_storeId_periodKey_idx" ON "orders"("storeId", "periodKey");

-- CreateIndex
CREATE INDEX "orders_orderSn_idx" ON "orders"("orderSn");

-- CreateIndex
CREATE UNIQUE INDEX "period_locks_periodKey_key" ON "period_locks"("periodKey");

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_logs" ADD CONSTRAINT "upload_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_logs" ADD CONSTRAINT "upload_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_uploadLogId_fkey" FOREIGN KEY ("uploadLogId") REFERENCES "upload_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
