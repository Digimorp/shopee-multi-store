import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { getAccessibleStoreIds, assertStoreAccess } from "@/lib/rbac";
import { OrderStatus } from "@prisma/client";
import { getPeriodForDate, formatPeriodLabel, parsePeriodKey } from "@/lib/period";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";

// type=monthly -> rekap per periode cut-off (26-25) untuk N bulan terakhir
// type=yearly  -> rekap per tahun, multi toko
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "monthly";
  const storeIdParam = searchParams.get("storeId");
  const storeIds = await assertStoreAccess(user, storeIdParam);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await prisma.periodSetting.findFirst();
  const cutoffDay = period?.cutoffDay ?? 25;

  const orders = await prisma.order.findMany({
    where: { storeId: { in: storeIds }, status: { not: OrderStatus.CANCEL }, deletedAt: null },
    select: { orderSn: true, orderCreatedAt: true, grossOmzet: true, netSettlement: true, hppSnapshot: true, qty: true, status: true, periodKey: true },
  });

  // Rekap mencakup SEMUA periode order toko ini sekaligus (endpoint ini tidak menerima
  // filter from/to), jadi reconcile() dipanggil dengan rentang tanggal seluas mungkin
  // supaya semua order ikut ter-cover pencarian match Income Report. Profit HPP HARUS
  // pakai nilai AKTUAL, BUKAN Order.profitHpp yang cuma estimasi dari file Pesanan --
  // sama seperti /rekonsiliasi & Laporan Profit (lihat src/lib/reconciliation.ts).
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(
    await reconcile({ storeIds, from: new Date(0), to: new Date() })
  );
  const actualProfitHpp = (o: (typeof orders)[number]): number => {
    const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
    const groupAktual = aktualByOrderSn.get(o.orderSn);
    const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
    return lineAktual == null ? 0 : lineAktual - o.hppSnapshot * o.qty;
  };

  if (type === "yearly") {
    const byYear = new Map<string, { year: string; omzet: number; profitHpp: number }>();
    for (const o of orders) {
      const year = String(o.orderCreatedAt.getFullYear());
      const cur = byYear.get(year) ?? { year, omzet: 0, profitHpp: 0 };
      cur.omzet += o.grossOmzet;
      if (o.status === OrderStatus.SELESAI) cur.profitHpp += actualProfitHpp(o);
      byYear.set(year, cur);
    }
    return NextResponse.json({ rows: Array.from(byYear.values()).sort((a, b) => (a.year < b.year ? 1 : -1)) });
  }

  // monthly / comparison — grouping by periodKey (siklus cut-off 26-25)
  const byPeriod = new Map<string, { periodKey: string; label: string; omzet: number; profitHpp: number }>();
  for (const o of orders) {
    const key = o.periodKey || getPeriodForDate(o.orderCreatedAt, cutoffDay).key;
    const cur = byPeriod.get(key) ?? { periodKey: key, label: formatPeriodLabel(parsePeriodKey(key)), omzet: 0, profitHpp: 0 };
    cur.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) cur.profitHpp += actualProfitHpp(o);
    byPeriod.set(key, cur);
  }

  const rows = Array.from(byPeriod.values()).sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
  const rowsWithDelta = rows.map((r, i) => {
    const prev = rows[i + 1];
    const deltaOmzet = prev ? r.omzet - prev.omzet : 0;
    const deltaPct = prev && prev.omzet !== 0 ? (deltaOmzet / prev.omzet) * 100 : 0;
    return { ...r, deltaOmzet, deltaPct };
  });

  return NextResponse.json({ rows: rowsWithDelta });
}
