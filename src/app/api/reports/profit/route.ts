import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { productGroupKey } from "@/lib/profit";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";
import { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] },
      deletedAt: null,
    },
    select: {
      orderSn: true,
      sku: true,
      productId: true,
      productName: true,
      qty: true,
      grossOmzet: true,
      netSettlement: true,
      hppSnapshot: true,
      profitAgen: true,
      status: true,
      store: { select: { code: true, name: true } },
    },
  });

  // Uang Cair/Profit HPP HARUS pakai nilai AKTUAL (Income Report yang sudah match lewat
  // reconcile() -- sama seperti /rekonsiliasi), BUKAN Order.netSettlement yang cuma estimasi
  // dari file Pesanan (lihat src/lib/parseShopee.ts: netSettlementRaw = estimasi, angka
  // aktual baru datang dari Income Report). Order multi-item (1 No. Pesanan, banyak SKU)
  // payout-nya digabung -> dialokasikan proporsional per baris SKU lewat allocateActual().
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile({ storeIds, from, to }));

  // Unit Keluar/Omzet Bruto = HANYA status Selesai (barang benar-benar laku, sama seperti
  // Analisis Barang Keluar dulu). Profit Agen tetap dari SELESAI + PENDING_SETTLEMENT dan
  // independen dari uang cair (benchmark harga agen, bukan payout riil — lihat src/lib/profit.ts).
  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk (productId null & sku kosong) tetap terpisah
  // per nama produk, tidak collapse jadi satu baris gabungan.
  const bySku = new Map<
    string,
    { sku: string; name: string; qty: number; omzet: number; uangCair: number; profitHpp: number; profitAgen: number }
  >();
  for (const o of orders) {
    const key = productGroupKey(o);
    const cur =
      bySku.get(key) ?? { sku: o.sku, name: o.productName, qty: 0, omzet: 0, uangCair: 0, profitHpp: 0, profitAgen: 0 };
    if (o.status === OrderStatus.SELESAI) {
      cur.qty += o.qty;
      cur.omzet += o.grossOmzet;

      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const groupAktual = aktualByOrderSn.get(o.orderSn);
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
      if (lineAktual != null) {
        cur.uangCair += lineAktual;
        cur.profitHpp += lineAktual - o.hppSnapshot * o.qty;
      }
      // lineAktual null = order ini belum match ke Income Report (belum cair) -> tidak
      // dihitung ke Uang Cair/Profit HPP sama sekali (bukan ditandai 0, tapi excluded).
    }
    cur.profitAgen += o.profitAgen;
    bySku.set(key, cur);
  }

  const totalOmzet = Array.from(bySku.values()).reduce((s, r) => s + r.omzet, 0);
  const rows = Array.from(bySku.values()).map((r) => ({
    ...r,
    selisih: r.profitAgen - r.profitHpp,
    share: totalOmzet ? r.omzet / totalOmzet : 0,
  }));
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalUangCair = rows.reduce((s, r) => s + r.uangCair, 0);
  const totalProfitHpp = rows.reduce((s, r) => s + r.profitHpp, 0);
  const totalProfitAgen = rows.reduce((s, r) => s + r.profitAgen, 0);

  return NextResponse.json({
    rows: rows.sort((a, b) => b.profitHpp - a.profitHpp),
    summary: {
      totalQty,
      skuCount: rows.length,
      totalUangCair,
      totalProfitHpp,
      totalProfitAgen,
      selisih: totalProfitAgen - totalProfitHpp,
    },
  });
}
