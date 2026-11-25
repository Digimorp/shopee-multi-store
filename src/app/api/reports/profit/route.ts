import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { withPeriodError } from "@/lib/periodError";
import {
  productGroupKey,
  emptyTally,
  addProfitLine,
  emptyAgenTally,
  addAgenLine,
  type ProfitTally,
  type AgenTally,
} from "@/lib/profit";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";
import { OrderStatus } from "@prisma/client";
import { exportSku } from "@/lib/reports";
import { getUangCairPeriode } from "@/lib/uangCairPeriodeDb";
import { pickRincian } from "@/lib/uangCairPeriode";

export const GET = withPeriodError(async (req: NextRequest) => {
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
      product: { select: { sku: true } },
    },
  });

  // Uang Cair/Profit HPP HARUS pakai nilai AKTUAL (Income Report yang sudah match lewat
  // reconcile() -- sama seperti /rekonsiliasi), BUKAN Order.netSettlement yang cuma estimasi
  // dari file Pesanan (lihat src/lib/parseShopee.ts: netSettlementRaw = estimasi, angka
  // aktual baru datang dari Income Report). Order multi-item (1 No. Pesanan, banyak SKU)
  // payout-nya digabung -> dialokasikan proporsional per baris SKU lewat allocateActual().
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile({ storeIds, from, to }));

  // Unit Keluar/Omzet Pesanan = HANYA status Selesai (barang benar-benar laku, sama seperti
  // Analisis Barang Keluar dulu). Profit Agen tetap dari SELESAI + PENDING_SETTLEMENT dan
  // independen dari uang cair (benchmark harga agen, bukan payout riil — lihat src/lib/profit.ts).
  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk (productId null & sku kosong) tetap terpisah
  // per nama produk, tidak collapse jadi satu baris gabungan.
  // T-013: Profit HPP & Profit Agen HANYA dari baris yang HPP-nya diketahui (hppSnapshot > 0).
  // Baris tanpa HPP tetap masuk Uang Cair, tapi dilaporkan terpisah di tanpaHpp -- lihat
  // addProfitLine/addAgenLine di src/lib/profit.ts.
  const bySku = new Map<
    string,
    { sku: string; name: string; qty: number; omzet: number; hpp: ProfitTally; agen: AgenTally }
  >();
  for (const o of orders) {
    const key = productGroupKey(o);
    const cur =
      // T-013 temuan QA 7: SKU = logika exportSku (pesanan -> Master Produk -> "-"), sama dengan export.
      bySku.get(key) ?? { sku: exportSku(o), name: o.productName, qty: 0, omzet: 0, hpp: emptyTally(), agen: emptyAgenTally() };
    if (o.status === OrderStatus.SELESAI) {
      cur.qty += o.qty;
      cur.omzet += o.grossOmzet;

      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const groupAktual = aktualByOrderSn.get(o.orderSn);
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
      // lineAktual null = order ini belum match ke Income Report (belum cair) -> tidak
      // dihitung ke Uang Cair/Profit HPP sama sekali (bukan ditandai 0, tapi excluded).
      addProfitLine(cur.hpp, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    }
    addAgenLine(cur.agen, o);
    bySku.set(key, cur);
  }

  const groups = Array.from(bySku.values());
  const totalOmzet = groups.reduce((s, r) => s + r.omzet, 0);
  const rows = groups.map(({ hpp, agen, ...r }) => ({
    ...r,
    uangCair: hpp.uangCair,
    profitHpp: hpp.profitHpp,
    profitAgen: agen.profitAgen,
    tanpaHpp: hpp.tanpaHpp,
    selisih: agen.profitAgen - hpp.profitHpp,
    share: totalOmzet ? r.omzet / totalOmzet : 0,
  }));
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalUangCair = rows.reduce((s, r) => s + r.uangCair, 0);
  const totalProfitHpp = rows.reduce((s, r) => s + r.profitHpp, 0);
  const totalProfitAgen = rows.reduce((s, r) => s + r.profitAgen, 0);
  const tanpaHpp = {
    baris: groups.reduce((s, g) => s + g.hpp.tanpaHpp.baris, 0),
    uangCair: groups.reduce((s, g) => s + g.hpp.tanpaHpp.uangCair, 0),
  };
  const tanpaHppAgen = { baris: groups.reduce((s, g) => s + g.agen.tanpaHpp.baris, 0) };

  return NextResponse.json({
    rows: rows.sort((a, b) => b.profitHpp - a.profitHpp),
    summary: {
      totalQty,
      skuCount: rows.length,
      totalUangCair,
      totalProfitHpp,
      totalProfitAgen,
      selisih: totalProfitAgen - totalProfitHpp,
      tanpaHpp,
      tanpaHppAgen,
      // T-013 batch 13 (tugas X): angka utama Uang Cair = semua saldo masuk periode ini. totalUangCair
      // di atas = uang cair pesanan periode ini (jumlah kolom per SKU, basis Profit HPP).
      uangCairPeriode: pickRincian(await getUangCairPeriode({ storeIds, from, to })),
    },
  });
});
