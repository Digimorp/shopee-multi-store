import { OrderStatus } from "@prisma/client";
import { getPeriodForMonth, getPeriodMonthForDate, prevPeriodMonth, formatPeriodMonthLabel } from "@/lib/period";
import { allocateActual } from "@/lib/reconciliation";
import { emptyTally, addProfitLine, type ProfitTally } from "@/lib/profit";

/**
 * T-013 butir 10: Rekap Bulanan & Tahunan — satu sumber untuk API /api/reports/recap DAN
 * export (datasetRecap), supaya angkanya selalu sama.
 * - Bulan = periode cut-off yang DIHITUNG dari tanggal pesanan dibuat (WIB) dengan cut-off yang
 *   berlaku sekarang (getPeriodMonthForDate, pasangan getPeriodForMonth yang dipakai resolveFilters),
 *   BUKAN Order.periodKey yang tersimpan saat upload (kolom itu tidak diubah).
 * - Tahun = tahun dari kunci periode (YYYY dari "YYYY-MM"), supaya jumlah 12 bulan = tahunan persis.
 * - Selisih vs lalu = dibanding bulan tepat sebelumnya (YYYY-MM minus 1); tidak ada data -> null ("-").
 * Rumus omzet / Uang Cair / Profit HPP tidak berubah: omzet = grossOmzet semua status non-batal;
 * Uang Cair & Profit HPP = nilai AKTUAL Income Report (allocateActual + addProfitLine) untuk SELESAI.
 */
export type RecapOrder = {
  orderSn: string;
  orderCreatedAt: Date;
  grossOmzet: number;
  netSettlement: number;
  hppSnapshot: number;
  qty: number;
  status: OrderStatus | string;
};
export type ActualLookup = { estimasiByOrderSn: Map<string, number>; aktualByOrderSn: Map<string, number> };

export type RecapMonthRow = {
  /** "YYYY-MM" (bulan akhir periode cut-off) */
  month: string;
  /** kunci periode "YYYY-MM-DD_YYYY-MM-DD" (tanggal WIB), dihitung — bukan dari DB */
  periodKey: string;
  label: string;
  omzet: number;
  uangCair: number;
  profitHpp: number;
  tanpaHpp: ProfitTally["tanpaHpp"];
  /** null = bulan tepat sebelumnya tidak ada data */
  deltaOmzet: number | null;
  /** null = bulan sebelumnya tidak ada data, atau omzetnya 0 */
  deltaPct: number | null;
};
export type RecapYearRow = {
  year: string;
  omzet: number;
  uangCair: number;
  profitHpp: number;
  tanpaHpp: ProfitTally["tanpaHpp"];
};

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** "2026-07-26" -> "26 Jul 2026" (dari string, tidak bergeser karena zona waktu server). */
const fmtYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${BLN[m - 1]} ${y}`;
};

/** Label bulan rekap, mis. "Agustus 2026 (26 Jul 2026 - 25 Agu 2026)". */
export function recapMonthLabel(month: string, cutoffDay: number): string {
  const p = getPeriodForMonth(month, cutoffDay);
  const [from, to] = p.key.split("_");
  return `${formatPeriodMonthLabel(p)} (${fmtYmd(from)} - ${fmtYmd(to)})`;
}

export function buildRecap(
  orders: RecapOrder[],
  lookup: ActualLookup,
  cutoffDay: number
): { months: RecapMonthRow[]; years: RecapYearRow[] } {
  const byMonth = new Map<string, { omzet: number; hpp: ProfitTally }>();
  const byYear = new Map<string, { omzet: number; hpp: ProfitTally }>();

  for (const o of orders) {
    if (o.status === OrderStatus.CANCEL) continue;
    const month = getPeriodMonthForDate(o.orderCreatedAt, cutoffDay);
    const year = month.slice(0, 4);
    const m = byMonth.get(month) ?? { omzet: 0, hpp: emptyTally() };
    const y = byYear.get(year) ?? { omzet: 0, hpp: emptyTally() };
    m.omzet += o.grossOmzet;
    y.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) {
      const groupEstimasi = lookup.estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, lookup.aktualByOrderSn.get(o.orderSn));
      const line = { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual };
      addProfitLine(m.hpp, line);
      addProfitLine(y.hpp, line);
    }
    byMonth.set(month, m);
    byYear.set(year, y);
  }

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, r]): RecapMonthRow => {
      const prev = byMonth.get(prevPeriodMonth(month));
      const deltaOmzet = prev ? r.omzet - prev.omzet : null;
      const deltaPct = prev && prev.omzet !== 0 ? ((r.omzet - prev.omzet) / prev.omzet) * 100 : null;
      return {
        month,
        periodKey: getPeriodForMonth(month, cutoffDay).key,
        label: recapMonthLabel(month, cutoffDay),
        omzet: r.omzet,
        uangCair: r.hpp.uangCair,
        profitHpp: r.hpp.profitHpp,
        tanpaHpp: r.hpp.tanpaHpp,
        deltaOmzet,
        deltaPct,
      };
    });

  const years = [...byYear.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([year, r]): RecapYearRow => ({
      year,
      omzet: r.omzet,
      uangCair: r.hpp.uangCair,
      profitHpp: r.hpp.profitHpp,
      tanpaHpp: r.hpp.tanpaHpp,
    }));

  return { months, years };
}
