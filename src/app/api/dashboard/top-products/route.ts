import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { withPeriodError } from "@/lib/periodError";
import { productGroupKey, emptyTally, addProfitLine, type ProfitTally } from "@/lib/profit";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";
import { OrderStatus } from "@prisma/client";

// Analisis barang keluar / Top Produk — HANYA status SELESAI (barang benar-benar laku & cair).
export const GET = withPeriodError(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: OrderStatus.SELESAI,
      deletedAt: null,
    },
    select: { orderSn: true, sku: true, productId: true, productName: true, qty: true, grossOmzet: true, netSettlement: true, hppSnapshot: true },
  });

  // Uang Cair/Profit HPP HARUS pakai nilai AKTUAL dari Income Report yang sudah match lewat
  // reconcile() (sama seperti /rekonsiliasi), BUKAN Order.netSettlement yang cuma estimasi
  // dari file Pesanan. Order multi-item payout-nya digabung -> dialokasikan proporsional per
  // baris SKU lewat allocateActual(). Order yang belum match (belum cair) tidak dihitung.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile({ storeIds, from, to }));

  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk (productId null & sku kosong) tetap terpisah
  // per nama produk, tidak collapse jadi satu baris gabungan.
  const bySku = new Map<
    string,
    { sku: string; name: string; omzet: number; qty: number } & ProfitTally
  >();
  // T-013: cur menyimpan field ProfitTally (profitHpp, uangCair, tanpaHpp) langsung; baris tanpa
  // HPP (hppSnapshot = 0) tidak masuk profitHpp tapi dijumlah di tanpaHpp.
  for (const o of orders) {
    const key = productGroupKey(o);
    const cur =
      bySku.get(key) ?? { sku: o.sku, name: o.productName, omzet: 0, qty: 0, ...emptyTally() };
    cur.omzet += o.grossOmzet;
    cur.qty += o.qty;

    const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
    const groupAktual = aktualByOrderSn.get(o.orderSn);
    const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
    addProfitLine(cur, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    bySku.set(key, cur);
  }

  const all = Array.from(bySku.values());
  const totalQty = all.reduce((s, r) => s + r.qty, 0);
  const allRanked = [...all]
    .sort((a, b) => b.qty - a.qty)
    .map((r, i) => ({ ...r, rank: i + 1, share: totalQty ? r.qty / totalQty : 0 }));

  const byOmzet = [...all].sort((a, b) => b.omzet - a.omzet).slice(0, 15);
  const byQty = [...all].sort((a, b) => b.qty - a.qty).slice(0, 15);

  const tanpaHpp = {
    baris: all.reduce((s, r) => s + r.tanpaHpp.baris, 0),
    uangCair: all.reduce((s, r) => s + r.tanpaHpp.uangCair, 0),
  };

  return NextResponse.json({ byOmzet, byQty, all: allRanked, totalQty, skuCount: all.length, tanpaHpp });
});
