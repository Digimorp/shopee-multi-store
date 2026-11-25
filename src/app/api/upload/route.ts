import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { parseShopeeFile } from "@/lib/parseShopee";
import { classifyStatus, DEFAULT_STATUS_RULES, type StatusRule } from "@/lib/classification";
import { calcProfitHpp, calcProfitAgen } from "@/lib/profit";
import { getPeriodForDateWib } from "@/lib/period";
import { OrderStatus, Prisma } from "@prisma/client";

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

  // AI Anomaly Check DINONAKTIFKAN (T-013): analyzeUploadAnomalies tidak dipanggil lagi saat
  // upload. File src/lib/aiAnomalyCheck.ts sengaja dibiarkan (tidak dihapus).

  // HPP tidak diketahui (T-013): baris yang produknya tidak ketemu di Master Produk, atau
  // ketemu tapi HPP di master belum diisi (<= 0), TIDAK dianggap HPP 0. Penanda tanpa ubah
  // skema: hppSnapshot = 0 (dan productId = null kalau tidak ketemu di master) berarti
  // "HPP tidak diketahui"; profitHpp & profitAgen baris itu disimpan 0, bukan dihitung dari
  // HPP palsu 0 (yang bikin profit terlihat sebesar omzet).
  const hppUnknownNotInMaster = new Map<string, number>(); // sku/nama -> jumlah baris
  const hppUnknownEmptyInMaster = new Map<string, number>();
  let hppUnknownRows = 0;

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

    // Skip baris di periode yang sudah dikunci. T-013 butir 19: periode dihitung dalam WIB (bukan jam
    // server) — key yang SAMA dipakai untuk cek kunci dan untuk periodKey yang disimpan.
    const periodInfo = getPeriodForDateWib(row.orderCreatedAt, cutoffDay);
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
    const hppKnown = !!product && product.hpp > 0;
    const hpp = hppKnown ? product!.hpp : 0; // 0 di sini = penanda "tidak diketahui", bukan HPP 0
    const catalogPrice = product?.catalogPrice ?? 0;
    if (!hppKnown) {
      hppUnknownRows++;
      const key = product?.sku || row.sku || row.skuInduk || row.productName;
      const bucket = product ? hppUnknownEmptyInMaster : hppUnknownNotInMaster;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }

    // Profit HPP (Nett): butuh uang benar-benar cair -> SELESAI saja.
    // Profit Agen: benchmark harga agen, dianggap terealisasi saat barang sampai ke pembeli
    // -> SELESAI atau PENDING_SETTLEMENT. TRANSIT/RETUR/CANCEL = 0.
    const profitHpp =
      hppKnown && status === OrderStatus.SELESAI ? calcProfitHpp({ netSettlement, hpp, qty: row.qty }) : 0;
    const profitAgen =
      hppKnown && (status === OrderStatus.SELESAI || status === OrderStatus.PENDING_SETTLEMENT)
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

  // Peringatan HPP tidak diketahui — disimpan juga ke UploadLog supaya bisa dilihat lagi
  // setelah respons upload tertutup (GET /api/uploads). Pakai kolom aiCheckResult (Json) yang
  // sudah ada & tidak terisi lagi sejak AI dinonaktifkan (T-013) — tanpa migrasi schema.
  // Bentuknya tetap kompatibel dengan pembaca lama (anomalies/summary/aiCheckSkipped).
  const hppUnknown = {
    rows: hppUnknownRows,
    // Batch4 I (butir 8): jumlah SKU/produk unik tanpa HPP dari baris file ini saja.
    products: new Set([...hppUnknownNotInMaster.keys(), ...hppUnknownEmptyInMaster.keys()]).size,
    notInMaster: [...hppUnknownNotInMaster].map(([sku, rows]) => ({ sku, rows })),
    emptyInMaster: [...hppUnknownEmptyInMaster].map(([sku, rows]) => ({ sku, rows })),
  };
  const uploadCheckResult = {
    source: "hpp-check",
    hppUnknown,
    anomalies: [],
    summary:
      hppUnknownRows > 0
        ? `${hppUnknownRows} baris HPP tidak diketahui (${hppUnknown.notInMaster.length} SKU tidak ada di Master Produk, ${hppUnknown.emptyInMaster.length} SKU HPP belum diisi).`
        : "Semua baris punya HPP.",
    aiCheckSkipped: true,
  };

  await prisma.uploadLog.update({
    where: { id: uploadLog.id },
    data: {
      successRows: success,
      failedRows: totalRows - success,
      aiCheckResult: uploadCheckResult as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    uploadLogId: uploadLog.id,
    totalRows,
    success,
    skippedLocked,
    skippedOrFailed: totalRows - success,
    parseErrors: errors.slice(0, 20),
    // Peringatan HPP tidak diketahui — profit baris-baris ini BELUM bisa dihitung.
    hppUnknown,
  });
}
