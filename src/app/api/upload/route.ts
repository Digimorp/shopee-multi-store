import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { parseShopeeFile } from "@/lib/parseShopee";
import { classifyStatus, DEFAULT_STATUS_RULES, type StatusRule } from "@/lib/classification";
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

  const periodSetting = await prisma.periodSetting.findFirst();
  const cutoffDay = periodSetting?.cutoffDay ?? 25;

  // Aturan klasifikasi status: dari DB kalau ada, kalau kosong pakai default bawaan
  const dbRules = await prisma.statusMapping.findMany({ where: { isActive: true } });
  const rules: StatusRule[] = dbRules.length
    ? dbRules.map((r) => ({ pattern: r.pattern, category: r.category, priority: r.priority }))
    : DEFAULT_STATUS_RULES;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors, totalRows } = parseShopeeFile(buffer);

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          errors[0]?.message ??
          "File Pesanan tidak bisa diparsing (tidak ada baris valid). Cek header & sheet file export Shopee.",
        details: errors,
      },
      { status: 400 }
    );
  }

  // Master produk global — cocokkan via Nomor Referensi SKU, lalu SKU Induk, lalu nama produk.
  const products = await prisma.product.findMany();
  const productMap = new Map(products.map((p) => [p.sku, p]));
  const productByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
  const matchProduct = (row: (typeof rows)[number]) =>
    productMap.get(row.sku) ||
    (row.skuInduk ? productMap.get(row.skuInduk) : undefined) ||
    productByName.get(row.productName.trim().toLowerCase());

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
  let skippedLocked = 0;

  for (const row of rows) {
    // Klasifikasi status
    let status = classifyStatus(row.rawStatus, rules);
    // "Sudah sampai, belum cair": ditandai SELESAI oleh Shopee tapi dana belum dilepaskan.
    // Hanya berlaku untuk file yang PUNYA kolom "Waktu Dana Dilepaskan" (format lama).
    // Skema resmi baru tidak punya kolom itu -> status "cair" ditentukan lewat Rekonsiliasi
    // (Income Report) sebagai layer di atas, bukan di-downgrade di sini.
    if (status === OrderStatus.SELESAI && row.settlementColumnPresent && !row.hasSettlementDate) {
      status = OrderStatus.PENDING_SETTLEMENT;
    }

    // Skip baris di periode yang sudah dikunci
    const periodInfo = getPeriodForDate(row.orderCreatedAt, cutoffDay);
    const lock = await prisma.periodLock.findUnique({ where: { periodKey: periodInfo.key } });
    if (lock?.locked) {
      skippedLocked++;
      continue;
    }

    // Penyesuaian nilai berdasarkan status
    const isCancel = status === OrderStatus.CANCEL;
    const grossOmzet = isCancel ? 0 : row.totalPayment;
    const netSettlement = isCancel ? 0 : row.netSettlementRaw;

    const product = matchProduct(row);
    const hpp = product?.hpp ?? 0;
    const catalogPrice = product?.catalogPrice ?? 0;

    // Profit HPP (Nett): butuh uang benar-benar cair -> SELESAI saja.
    // Profit Agen: benchmark harga agen, dianggap terealisasi saat barang sampai ke pembeli
    // -> SELESAI atau PENDING_SETTLEMENT. TRANSIT/RETUR/CANCEL = 0.
    const profitHpp =
      status === OrderStatus.SELESAI ? calcProfitHpp({ netSettlement, hpp, qty: row.qty }) : 0;
    const profitAgen =
      status === OrderStatus.SELESAI || status === OrderStatus.PENDING_SETTLEMENT
        ? calcProfitAgen({ catalogPrice, hpp, qty: row.qty })
        : 0;

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
        completedAt: row.completedAt,
        settlementDate: row.settlementDate,
        status,
        grossOmzet,
        netSettlement,
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
    skippedLocked,
    skippedOrFailed: totalRows - success,
    parseErrors: errors.slice(0, 20),
  });
}
