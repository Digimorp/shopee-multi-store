import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { parseShopeeFile } from "@/lib/parseShopee";
import { calcProfitHpp, calcProfitAgen } from "@/lib/profit";
import { getPeriodForDate } from "@/lib/period";
import { OrderStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const storeId = form.get("storeId") as string | null;
  if (!file || !storeId) return NextResponse.json({ error: "file dan storeId wajib" }, { status: 400 });

  const storeIds = await assertStoreAccess(user, storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden - toko tidak dikuasakan" }, { status: 403 });

  const period = await prisma.periodSetting.findFirst();
  const cutoffDay = period?.cutoffDay ?? 25;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors, totalRows } = parseShopeeFile(buffer);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Gagal parsing file", details: errors }, { status: 400 });
  }

  const products = await prisma.product.findMany({ where: { storeId } });
  const productMap = new Map(products.map((p) => [p.sku, p]));

  const uploadLog = await prisma.uploadLog.create({
    data: {
      storeId,
      adminUserId: user.id,
      fileName: file.name,
      totalRows,
      successRows: 0,
      failedRows: errors.length,
      errorLog: errors.length ? JSON.stringify(errors.slice(0, 50)) : null,
    },
  });

  let success = 0;
  for (const row of rows) {
    // Cek periode terkunci
    const periodInfo = getPeriodForDate(row.orderCreatedAt, cutoffDay);
    const lock = await prisma.periodLock.findUnique({ where: { periodKey: periodInfo.key } });
    if (lock?.locked) continue; // skip baris di periode yang sudah dikunci

    const product = productMap.get(row.sku);
    const hpp = product?.hpp ?? 0;
    const catalogPrice = product?.catalogPrice ?? 0;

    const profitHpp =
      row.status === OrderStatus.SELESAI
        ? calcProfitHpp({ netSettlement: row.netSettlement, hpp, qty: row.qty })
        : 0;
    const profitAgen =
      row.status === OrderStatus.CANCEL
        ? 0
        : calcProfitAgen({ catalogPrice, hpp, qty: row.qty, netSettlement: row.netSettlement });

    await prisma.order.create({
      data: {
        storeId,
        productId: product?.id,
        uploadLogId: uploadLog.id,
        orderSn: row.orderSn,
        sku: row.sku,
        productName: row.productName,
        qty: row.qty,
        orderCreatedAt: row.orderCreatedAt,
        status: row.status,
        grossOmzet: row.grossOmzet,
        netSettlement: row.netSettlement,
        adminFee: row.adminFee,
        hppSnapshot: hpp,
        catalogPriceSnapshot: catalogPrice,
        profitHpp,
        profitAgen,
        periodKey: periodInfo.key,
        rawRow: JSON.stringify(row.raw).slice(0, 4000),
      },
    });
    success++;
  }

  await prisma.uploadLog.update({
    where: { id: uploadLog.id },
    data: { successRows: success, failedRows: totalRows - success },
  });

  return NextResponse.json({
    uploadLogId: uploadLog.id,
    totalRows,
    success,
    skippedOrFailed: totalRows - success,
    parseErrors: errors.slice(0, 20),
  });
}
