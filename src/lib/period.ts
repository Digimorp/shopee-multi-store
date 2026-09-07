import {
  addMonths,
  format,
  setDate,
  subMonths,
} from "date-fns";

export type Period = { from: Date; to: Date; key: string };

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** Bikin objek Period dari tanggal awal & akhir. Key dipakai sebagai grouping id di DB. */
export function makePeriod(from: Date, to: Date): Period {
  return { from, to, key: `${fmt(from)}_${fmt(to)}` };
}

/**
 * Periode cut-off default aplikasi: tanggal 26 bulan lalu s/d tanggal 25 bulan ini,
 * sesuai siklus laporan Shopee multi-toko.
 */
export function getDefaultPeriod(cutoffDay = 25, now = new Date()): Period {
  const to = setDate(now, cutoffDay);
  const from = setDate(subMonths(now, 1), cutoffDay + 1);
  return makePeriod(from, to);
}

/**
 * Tentukan periode cut-off untuk sebuah tanggal transaksi.
 * Kalau tanggal <= cutoffDay -> masuk periode (26 bulan sebelumnya s/d cutoffDay bulan ini).
 * Kalau tanggal > cutoffDay -> masuk periode (26 bulan ini s/d cutoffDay bulan depan).
 */
export function getPeriodForDate(date: Date, cutoffDay = 25): Period {
  const day = date.getDate();
  if (day <= cutoffDay) {
    const to = setDate(date, cutoffDay);
    const from = setDate(subMonths(date, 1), cutoffDay + 1);
    return makePeriod(from, to);
  }
  const to = setDate(addMonths(date, 1), cutoffDay);
  const from = setDate(date, cutoffDay + 1);
  return makePeriod(from, to);
}

export function formatPeriodLabel(period: Period): string {
  return `${format(period.from, "d MMM yyyy")} - ${format(period.to, "d MMM yyyy")}`;
}

export function parsePeriodKey(key: string): Period {
  const [fromStr, toStr] = key.split("_");
  return makePeriod(new Date(fromStr), new Date(toStr));
}
