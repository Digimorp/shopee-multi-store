import { formatNumber } from "@/lib/format";

export type HppUnknownItem = { sku: string; rows: number };
export type HppUnknown = {
  rows: number;
  /** jumlah SKU/produk unik tanpa HPP (respons lama tanpa field ini -> dihitung dari daftar) */
  products?: number;
  notInMaster?: HppUnknownItem[];
  emptyInMaster?: HppUnknownItem[];
};

/** Jumlah produk unik tanpa HPP; fallback ke panjang daftar untuk respons/UploadLog lama. */
export function hppUnknownProducts(h: HppUnknown): number {
  return h.products ?? (h.notInMaster?.length ?? 0) + (h.emptyInMaster?.length ?? 0);
}

function ItemList({ title, items }: { title: string; items?: HppUnknownItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
        {items.map((x) => (
          <li key={`${title}-${x.sku}`}>
            {x.sku} <span className="text-amber-600">({formatNumber(x.rows)} baris)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * T-013 butir 8: peringatan sesudah upload pesanan — ada produk yang HPP-nya belum diisi.
 * Dihitung dari baris file yang baru di-upload (respons POST /api/upload). Hanya tampil kalau > 0.
 * Gaya amber sama dengan TanpaHppNote. Tidak memblokir apa pun; HPP 0 = tidak diketahui.
 */
export default function HppUnknownBanner({ hppUnknown }: { hppUnknown?: HppUnknown | null }) {
  if (!hppUnknown || !(hppUnknown.rows > 0)) return null;
  const n = hppUnknownProducts(hppUnknown);
  return (
    <div
      role="status"
      className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
    >
      <p className="text-sm font-semibold">
        {formatNumber(n)} produk tanpa HPP ({formatNumber(hppUnknown.rows)} baris).
      </p>
      <p className="mt-1">Profit untuk produk ini belum dihitung sampai HPP diisi di Master Produk.</p>
      <ItemList title="Tidak ditemukan di Master Produk:" items={hppUnknown.notInMaster} />
      <ItemList title="Ada di Master Produk tapi HPP belum diisi:" items={hppUnknown.emptyInMaster} />
    </div>
  );
}
