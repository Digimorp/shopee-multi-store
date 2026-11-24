export type ProfitHppInput = {
  qty: number;
  netSettlement: number; // Uang cair Shopee (setelah biaya admin) untuk baris ini
  hpp: number; // HPP per unit (snapshot)
};

export type ProfitAgenInput = {
  qty: number;
  hpp: number; // HPP per unit (snapshot)
  catalogPrice: number; // Harga katalog per unit, sebelum diskon 50% (snapshot)
};

/** Profit HPP (Nett) = Uang Cair Shopee - (HPP x qty). Hanya relevan untuk status SELESAI (uang cair). */
export function calcProfitHpp({ netSettlement, hpp, qty }: ProfitHppInput): number {
  return netSettlement - hpp * qty;
}

/** Profit Agen = (Harga Katalog x 50% - HPP) x qty. Independen dari status pencairan. */
export function calcProfitAgen({ catalogPrice, hpp, qty }: ProfitAgenInput): number {
  const hargaAgen = catalogPrice * 0.5;
  return (hargaAgen - hpp) * qty;
}

export function calcSelisihProfit(profitAgen: number, profitHpp: number): number {
  return profitAgen - profitHpp;
}

export type ProductGroupKeyInput = { productId?: string | null; sku: string; productName: string };

/**
 * Kunci pengelompokan per-produk untuk laporan agregat (Laporan Profit, Analisis Barang
 * Keluar, Top Produk). Utamakan productId (paling stabil kalau ada), lalu SKU, lalu nama
 * produk sebagai fallback terakhir -- supaya order yang belum ter-link ke Master Produk
 * (productId null DAN sku kosong, mis. file upload tanpa kolom SKU) tidak semua collapse
 * jadi satu baris gabungan; tetap terpisah per nama produk.
 */
export function productGroupKey(o: ProductGroupKeyInput): string {
  return o.productId ?? (o.sku || o.productName);
}

// ---------------------------------------------------------------------------
// T-013 nomor 1: profit hanya dari baris yang HPP-nya diketahui.
// hppSnapshot = 0 adalah penanda "HPP tidak diketahui" (produk tidak ada di master atau
// HPP master kosong saat upload) -- BUKAN modal nol. Baris seperti itu tidak boleh terlihat
// sebagai profit penuh; uang cairnya tetap dihitung ke total Uang Cair, tapi dilaporkan
// terpisah sebagai "Tanpa HPP: X baris, Rp Y".
// ---------------------------------------------------------------------------

/** HPP diketahui kalau snapshot > 0. 0 (atau negatif) = tidak diketahui. */
export const isHppKnown = (hppSnapshot: number): boolean => hppSnapshot > 0;

/** Satu baris pesanan untuk Profit HPP. uangCair null = belum cair (belum match Income Report). */
export type ProfitLine = { qty: number; hppSnapshot: number; uangCair: number | null };

export type ProfitTally = {
  /** Profit HPP (Nett): hanya baris yang HPP-nya diketahui DAN sudah cair. */
  profitHpp: number;
  /** Total uang cair semua baris yang sudah cair, termasuk yang tanpa HPP. */
  uangCair: number;
  /** Baris sudah cair tapi HPP tidak diketahui: tidak masuk profit, dilaporkan terpisah. */
  tanpaHpp: { baris: number; uangCair: number };
};

export const emptyTally = (): ProfitTally => ({ profitHpp: 0, uangCair: 0, tanpaHpp: { baris: 0, uangCair: 0 } });

/** Profit HPP satu baris: null kalau belum cair atau HPP tidak diketahui. */
export function lineProfitHpp(l: ProfitLine): number | null {
  if (l.uangCair == null || !isHppKnown(l.hppSnapshot)) return null;
  return l.uangCair - l.hppSnapshot * l.qty;
}

/** Tambahkan satu baris ke tally (mutasi t). Baris belum cair diabaikan seluruhnya. */
export function addProfitLine(t: ProfitTally, l: ProfitLine): void {
  if (l.uangCair == null) return;
  t.uangCair += l.uangCair;
  const p = lineProfitHpp(l);
  if (p == null) {
    t.tanpaHpp.baris += 1;
    t.tanpaHpp.uangCair += l.uangCair;
  } else {
    t.profitHpp += p;
  }
}

/** Satu baris untuk Profit Agen. profitAgen = nilai tersimpan di Order (sudah per baris x qty). */
export type AgenLine = { hppSnapshot: number; profitAgen: number };

export type AgenTally = {
  /** Profit Agen: hanya baris yang HPP-nya diketahui. */
  profitAgen: number;
  /** Baris tanpa HPP: Profit Agen-nya tidak dihitung. */
  tanpaHpp: { baris: number };
};

export const emptyAgenTally = (): AgenTally => ({ profitAgen: 0, tanpaHpp: { baris: 0 } });

/** Profit Agen satu baris: null kalau HPP tidak diketahui. */
export function lineProfitAgen(l: AgenLine): number | null {
  return isHppKnown(l.hppSnapshot) ? l.profitAgen : null;
}

/** Tambahkan satu baris ke tally Profit Agen (mutasi t). */
export function addAgenLine(t: AgenTally, l: AgenLine): void {
  const p = lineProfitAgen(l);
  if (p == null) t.tanpaHpp.baris += 1;
  else t.profitAgen += p;
}
