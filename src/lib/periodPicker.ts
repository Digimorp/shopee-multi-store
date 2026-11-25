import { formatPeriodRangeLabel, getPeriodForMonth, getPeriodMonthForDate } from "@/lib/period";

/**
 * T-013 batch 15 (bagian C): satu pemilih Periode (bulan) di TopBar.
 * Hanya tampilan & konversi URL -- rumus periode tetap di src/lib/period.ts (tidak diubah).
 */
export const PERIOD_BASIS_NOTE = "berdasarkan tanggal pesanan dibuat (WIB)";
/** Tab Uang Cair: totalnya memakai tanggal uang masuk (batch 13), bukan tanggal pesanan. */
export const PERIOD_BASIS_NOTE_UANG_CAIR = "berdasarkan tanggal uang masuk (WIB)";
export const PERIOD_OPTIONS = 12; // jumlah periode di dropdown (terbaru di atas)

/** Nama periode untuk bulan kunci URL, mis. "2026-07" (cutoff 25) -> "26 Jun - 25 Jul 2026". */
export function formatPeriodRange(month: string, cutoffDay = 25): string {
  return formatPeriodRangeLabel(getPeriodForMonth(month, cutoffDay));
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})/;
/** Tanggal "YYYY-MM-DD" dari link lama -> bulan periode yang memuatnya (dibaca sebagai tanggal WIB). */
function monthOfLegacyDate(v: string | null, cutoffDay: number): string | null {
  const m = v ? YMD.exec(v) : null;
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : getPeriodMonthForDate(d, cutoffDay);
}

/**
 * Link lama ?from=&to= -> ?period=YYYY-MM (periode yang memuat tanggal `to`, atau `from` kalau `to`
 * kosong/rusak). Kalau `period` sudah ada, from/to cukup dibuang (period selalu menang).
 * Mengembalikan query baru, atau null kalau tidak ada yang perlu diubah.
 */
export function convertLegacyRange(params: URLSearchParams, cutoffDay = 25): URLSearchParams | null {
  const from = params.get("from");
  const to = params.get("to");
  if (from == null && to == null) return null;
  const next = new URLSearchParams(params.toString());
  next.delete("from");
  next.delete("to");
  if (!params.get("period")) {
    const month = monthOfLegacyDate(to, cutoffDay) ?? monthOfLegacyDate(from, cutoffDay);
    if (month) next.set("period", month);
  }
  return next;
}
