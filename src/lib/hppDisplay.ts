/**
 * T-013 temuan QA 2 (batch 10): aturan TAMPILAN untuk baris yang HPP-nya tidak diketahui.
 *
 * Keputusan: HPP 0 = tidak diketahui -> tidak dihitung ke profit (sudah di src/lib/profit.ts) DAN
 * tidak boleh tampil seolah-olah nol. Modul ini hanya memutuskan apa yang DITAMPILKAN; rumus,
 * total, dan tanggapan API tidak berubah. Statusnya diturunkan dari field ProfitTally yang sudah
 * ada di tiap baris (profitHpp, uangCair, tanpaHpp):
 *
 *  - "tidak diketahui" = ada baris tanpa HPP yang sudah cair, profit 0, dan SEMUA uang cair grup
 *    berasal dari baris tanpa HPP (uangCair == tanpaHpp.uangCair). Satu saja baris ber-HPP yang
 *    cair membuat selisih uang cair > 0 atau profit != 0 -> grup dianggap diketahui (campuran:
 *    angka tetap ditampilkan + catatan Tanpa HPP seperti sebelumnya).
 *  - Grup tanpa baris cair sama sekali (belum cair / tidak ada transaksi) BUKAN urusan HPP:
 *    ditampilkan apa adanya.
 */
import { formatRupiah } from "@/lib/format";

export const HPP_UNKNOWN_TEXT = "-";

export type HppTallyLike = {
  profitHpp: number;
  uangCair: number;
  tanpaHpp?: { baris: number; uangCair: number } | null;
};

/** Toleransi pembulatan (rupiah) saat membandingkan uangCair dengan tanpaHpp.uangCair. */
const EPS = 0.5;

/** true = Profit HPP grup ini tidak bisa dihitung karena seluruh baris cairnya tanpa HPP. */
export function isProfitHppUnknown(r: HppTallyLike): boolean {
  const t = r.tanpaHpp;
  if (!t || !(t.baris > 0)) return false;
  return (r.profitHpp ?? 0) === 0 && Math.abs((r.uangCair ?? 0) - t.uangCair) < EPS;
}

/** true = minimal satu baris cair di grup ini punya HPP diketahui (profitnya benar-benar dihitung). */
export function hasKnownHpp(r: HppTallyLike): boolean {
  return (r.profitHpp ?? 0) !== 0 || Math.abs((r.uangCair ?? 0) - (r.tanpaHpp?.uangCair ?? 0)) >= EPS;
}

/** Profit HPP untuk ditampilkan: angka, atau "-" kalau tidak diketahui. */
export function shownProfitHpp(r: HppTallyLike): number | typeof HPP_UNKNOWN_TEXT {
  return isProfitHppUnknown(r) ? HPP_UNKNOWN_TEXT : r.profitHpp;
}

/**
 * Profit Agen untuk ditampilkan. "-" HANYA kalau HPP grup tidak diketahui DAN Profit Agen 0
 * (artinya tidak ada baris agen ber-HPP yang ikut dihitung). Profit Agen != 0 tetap angka.
 */
export function shownProfitAgen(r: HppTallyLike & { profitAgen: number }): number | typeof HPP_UNKNOWN_TEXT {
  return isProfitHppUnknown(r) && (r.profitAgen ?? 0) === 0 ? HPP_UNKNOWN_TEXT : r.profitAgen;
}

/** Selisih (Agen - HPP) untuk ditampilkan: "-" kalau Profit HPP tidak diketahui. */
export function shownSelisih(r: HppTallyLike & { selisih: number }): number | typeof HPP_UNKNOWN_TEXT {
  return isProfitHppUnknown(r) ? HPP_UNKNOWN_TEXT : r.selisih;
}

/**
 * Kartu Profit HPP Dashboard (T-013 batch 11). API ringkasan dashboard tidak mengirim uang cair
 * tally HPP, jadi dipakai `cair` (Uang Cair aktual Income Report -- sama dengan Uang Cair Laporan
 * Profit). Aturannya tetap isProfitHppUnknown: "-" hanya bila seluruh uang cair dari baris tanpa
 * HPP. Tanpa ringkasan (gagal muat / akun tanpa toko) -> "-".
 */
export function shownDashboardProfitHpp(
  s: { profitHpp?: number; cair?: number; tanpaHpp?: { baris: number; uangCair: number } | null } | null | undefined
): number | typeof HPP_UNKNOWN_TEXT {
  if (!s) return HPP_UNKNOWN_TEXT;
  return shownProfitHpp({ profitHpp: s.profitHpp ?? 0, uangCair: s.cair ?? 0, tanpaHpp: s.tanpaHpp });
}

/** Untuk sel di layar: "-" apa adanya, angka -> format rupiah. */
export function formatRupiahOrDash(v: number | string | null | undefined): string {
  return typeof v === "string" ? v : formatRupiah(v ?? 0);
}
