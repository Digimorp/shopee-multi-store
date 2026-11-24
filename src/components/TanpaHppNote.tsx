import { formatNumber, formatRupiah } from "@/lib/format";

export type TanpaHpp = { baris: number; uangCair: number };

/** Jumlahkan tanpaHpp dari baris-baris API (per toko / per periode). Field hilang dianggap 0. */
export function sumTanpaHpp(rows: { tanpaHpp?: TanpaHpp | null }[]): TanpaHpp {
  return rows.reduce<TanpaHpp>(
    (s, r) => ({ baris: s.baris + (r.tanpaHpp?.baris ?? 0), uangCair: s.uangCair + (r.tanpaHpp?.uangCair ?? 0) }),
    { baris: 0, uangCair: 0 }
  );
}

/**
 * T-013: catatan kecil di bawah angka Profit HPP -- baris yang sudah cair tapi HPP-nya tidak
 * diketahui (hppSnapshot = 0) tidak dihitung ke profit. Hanya tampil kalau ada barisnya.
 * Warna = gaya banner peringatan kuning yang sudah dipakai di app (amber-50 / amber-200 / amber-700).
 */
export default function TanpaHppNote({ tanpaHpp }: { tanpaHpp?: TanpaHpp | null }) {
  if (!tanpaHpp || !(tanpaHpp.baris > 0)) return null;
  return (
    <p className="inline-block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      Tanpa HPP: {formatNumber(tanpaHpp.baris)} baris, {formatRupiah(tanpaHpp.uangCair)} (tidak dihitung ke profit)
    </p>
  );
}
