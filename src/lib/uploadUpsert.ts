import { OrderStatus } from "@prisma/client";

/**
 * T-013 batch 12 (tugas W): upload pesanan IDEMPOTEN.
 *
 * Admin biasanya mengunggah 2 file Shopee (export rentang tanggal + export sisa "On Proses"),
 * dan pesanan yang sama bisa muncul di keduanya / diunggah ulang. Tanpa skema baru (tidak ada
 * unique index), identitas satu baris pesanan ditentukan di kode:
 *
 *   storeId + orderSn + KUNCI BARIS PRODUK (+ urutan kemunculan)
 *
 * Kunci baris produk:
 *  - SKU (Nomor Referensi SKU, fallback SKU Induk -- sama dengan kolom Order.sku) kalau ada;
 *  - kalau SKU kosong: nama produk + nama variasi. Order tidak punya kolom variasi, jadi variasi
 *    baris lama dibaca dari rawRow (JSON baris asli). Kalau rawRow tidak ada/tidak terbaca,
 *    variasi baris lama "tidak diketahui" -> dicocokkan dengan nama produk saja (cadangan).
 *  - baris identik dalam satu pesanan di file yang sama dibedakan dengan urutan kemunculan:
 *    kemunculan ke-k di file dipasangkan dengan baris lama ke-k (urut createdAt, id). Setiap
 *    baris lama hanya bisa dipakai satu kali per upload -> baris berbeda tidak saling menimpa.
 * Baris yang di-soft-delete (deletedAt terisi) diabaikan (tidak ikut dicocokkan).
 */

/**
 * ATURAN STATUS TIDAK BOLEH TURUN. Urutan maju sebuah pesanan:
 *   TRANSIT < PENDING_SETTLEMENT < SELESAI < RETUR = CANCEL
 * File lama (status lebih rendah) tidak boleh menimpa status yang lebih maju. RETUR dan CANCEL
 * sama-sama status akhir: satu tidak menimpa yang lain (status lama dipertahankan).
 * Kalau status baru lebih rendah, baris lama dibiarkan apa adanya (tidak ada field yang ditulis).
 */
export const UPLOAD_STATUS_RANK: Record<OrderStatus, number> = {
  [OrderStatus.TRANSIT]: 1,
  [OrderStatus.PENDING_SETTLEMENT]: 2,
  [OrderStatus.SELESAI]: 3,
  [OrderStatus.RETUR]: 4,
  [OrderStatus.CANCEL]: 4,
};

/** true = status dari file boleh dipakai untuk baris yang sudah ada. */
export function canApplyStatus(existing: OrderStatus, incoming: OrderStatus): boolean {
  if (existing === incoming) return true;
  return UPLOAD_STATUS_RANK[incoming] > UPLOAD_STATUS_RANK[existing];
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const VARIATION_HEADERS = ["nama variasi", "variation name"];

/** Nama variasi dari rawRow baris lama. null = tidak diketahui (rawRow kosong/terpotong/tanpa kolom). */
export function variationFromRawRow(rawRow: string | null | undefined): string | null {
  if (!rawRow) return null;
  try {
    const obj = JSON.parse(rawRow);
    if (!obj || typeof obj !== "object") return null;
    for (const [k, v] of Object.entries(obj)) {
      if (VARIATION_HEADERS.includes(norm(k))) return String(v ?? "").trim();
    }
    return null;
  } catch {
    return null;
  }
}

/** Kunci baris produk. variation null = tidak diketahui (hanya untuk baris lama). */
export function lineKey(sku: string, productName: string, variation: string | null): string {
  const s = norm(sku);
  if (s) return `sku:${s}`;
  return `nama:${norm(productName)}|var:${variation === null ? "?" : norm(variation)}`;
}

export type ExistingLine = {
  id: string;
  orderSn: string;
  sku: string;
  productName: string;
  rawRow: string | null;
};

/**
 * Pencocok baris file -> baris lama, di memori. Dibangun sekali dari hasil SATU query
 * (semua baris aktif toko itu untuk No. Pesanan yang ada di file).
 */
export function createLineMatcher<T extends ExistingLine>(existing: T[]) {
  // orderSn -> daftar baris lama (urutan input dipertahankan: createdAt, id)
  const byOrder = new Map<string, { line: T; key: string; nameKey: string; skuEmpty: boolean; varUnknown: boolean }[]>();
  for (const line of existing) {
    const variation = norm(line.sku) ? "" : variationFromRawRow(line.rawRow);
    const entry = {
      line,
      key: lineKey(line.sku, line.productName, variation),
      nameKey: norm(line.productName),
      skuEmpty: !norm(line.sku),
      varUnknown: variation === null,
    };
    const list = byOrder.get(line.orderSn);
    if (list) list.push(entry);
    else byOrder.set(line.orderSn, [entry]);
  }
  const claimed = new Set<string>();

  return {
    /** Baris lama yang cocok (belum dipakai baris lain di upload ini), atau null = baris baru. */
    match(orderSn: string, sku: string, productName: string, variation: string): T | null {
      const list = byOrder.get(orderSn);
      if (!list) return null;
      const key = lineKey(sku, productName, variation);
      let hit = list.find((e) => !claimed.has(e.line.id) && e.key === key);
      // Cadangan: baris lama tanpa SKU yang variasinya tidak diketahui -> cocokkan nama saja.
      if (!hit && !norm(sku)) {
        const name = norm(productName);
        hit = list.find((e) => !claimed.has(e.line.id) && e.skuEmpty && e.varUnknown && e.nameKey === name);
      }
      if (!hit) return null;
      claimed.add(hit.line.id);
      return hit.line;
    },
  };
}

/**
 * T-013 batch 14: omzet satu BARIS pesanan = Subtotal Pesanan baris itu; kalau 0/tidak ada -> Harga x
 * Jumlah. Total Pembayaran TIDAK dipakai (nilai seluruh pesanan, diulang di tiap baris produk).
 */
export function lineOmzet(row: { subtotal: number; unitPrice: number; qty: number }): number {
  return row.subtotal > 0 ? row.subtotal : Math.max(0, row.unitPrice * row.qty);
}

/** Bagi daftar jadi potongan (untuk query `in` yang panjang). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
