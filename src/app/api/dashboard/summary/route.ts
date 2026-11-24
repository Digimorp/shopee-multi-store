import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { withPeriodError } from "@/lib/periodError";
import { OrderStatus } from "@prisma/client";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";
import { emptyTally, addProfitLine, emptyAgenTally, addAgenLine } from "@/lib/profit";

export const GET = withPeriodError(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const baseWhere = { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, deletedAt: null };

  const [omzetBruto, uangMengambang, transit, profitLines, recon] = await Promise.all([
    prisma.order.aggregate({
      where: { ...baseWhere, status: { not: OrderStatus.CANCEL } },
      _sum: { grossOmzet: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.PENDING_SETTLEMENT },
      _sum: { netSettlement: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.TRANSIT },
      _sum: { netSettlement: true },
    }),
    // Baris untuk Profit HPP/Agen -- dihitung per baris, BUKAN dari kolom Order.profitHpp/profitAgen
    // tersimpan (estimasi saat upload; data lama bisa menyimpan profit penuh untuk HPP 0).
    prisma.order.findMany({
      where: { ...baseWhere, status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] } },
      select: { orderSn: true, qty: true, netSettlement: true, hppSnapshot: true, profitAgen: true, status: true },
    }),
    reconcile({ storeIds, from, to }),
  ]);

  // T-013: rumus SAMA dengan Laporan Profit (src/app/api/reports/profit/route.ts) -- uang cair
  // AKTUAL dari Income Report (reconcile + allocateActual), Profit HPP & Profit Agen hanya dari
  // baris yang HPP-nya diketahui; baris tanpa HPP dijumlah terpisah di tanpaHpp.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(recon);
  const hpp = emptyTally();
  const agen = emptyAgenTally();
  for (const o of profitLines) {
    if (o.status === OrderStatus.SELESAI) {
      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, aktualByOrderSn.get(o.orderSn));
      addProfitLine(hpp, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    }
    addAgenLine(agen, o);
  }

  // "Cair" TIDAK boleh dihitung dari total status Selesai (gross/estimasi dari data Order)
  // vs total Income Report -- beda cakupan periode (delay pencairan s.d. H+14) & beda basis
  // (gross vs net setelah fee). Match per No. Pesanan (reconcile()).
  // T-013 butir 9 (definisi Founder): Cair = aktual Income Report pesanan periode ini, apa pun
  // hasil cocoknya (MATCH + SELISIH) -- sama dengan Uang Cair Laporan Profit (buildActualLookup)
  // dan totals.aktualPesanan Rekonsiliasi. SELISIH SUDAH termasuk di Cair; selisihCount hanya
  // menandai pesanan yang perlu dicek admin. Income non-pesanan (side "income") tidak masuk.
  let cair = 0;
  let cairCount = 0;
  let belumCair = 0;
  let belumCairCount = 0;
  let selisihAktual = 0;
  let selisihCount = 0;
  for (const it of recon.items) {
    if (it.side !== "income" && (it.category === "MATCH" || it.category === "SELISIH")) {
      cair += it.aktual ?? 0;
      cairCount++;
      if (it.category === "SELISIH") {
        selisihAktual += it.aktual ?? 0;
        selisihCount++;
      }
    } else if (it.category === "BELUM_KETEMU" && it.side === "order" && it.status === OrderStatus.SELESAI) {
      belumCair += it.estimasi;
      belumCairCount++;
    }
  }

  return NextResponse.json({
    totalOmzetBruto: omzetBruto._sum.grossOmzet ?? 0,
    uangMengambang: uangMengambang._sum.netSettlement ?? 0,
    barangTransit: transit._sum.netSettlement ?? 0,
    profitHpp: hpp.profitHpp,
    profitAgen: agen.profitAgen,
    tanpaHpp: hpp.tanpaHpp,
    tanpaHppAgen: agen.tanpaHpp,
    cair,
    cairCount,
    belumCair,
    belumCairCount,
    // `selisih` = JUMLAH pesanan SELISIH (dulu Rp). Nilai Rp-nya di selisihAktual (sudah termasuk di cair).
    selisih: selisihCount,
    selisihCount,
    selisihAktual,
  });
});
