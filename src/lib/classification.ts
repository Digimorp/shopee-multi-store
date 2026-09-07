import { OrderStatus } from "@prisma/client";

export type StatusRule = { pattern: string; category: OrderStatus; priority: number };

/**
 * Aturan klasifikasi default — dipakai kalau tabel `status_mappings` di DB masih kosong.
 * Pattern dicocokkan sebagai substring (case-insensitive) ke kolom "Status Pesanan" Shopee.
 * priority kecil = lebih diprioritaskan saat beberapa pattern cocok.
 */
export const DEFAULT_STATUS_RULES: StatusRule[] = [
  { pattern: "batal", category: OrderStatus.CANCEL, priority: 10 },
  { pattern: "dibatalkan", category: OrderStatus.CANCEL, priority: 10 },
  { pattern: "pembatalan", category: OrderStatus.CANCEL, priority: 10 },
  { pattern: "pengembalian", category: OrderStatus.RETUR, priority: 10 },
  { pattern: "dikembalikan", category: OrderStatus.RETUR, priority: 10 },
  { pattern: "retur", category: OrderStatus.RETUR, priority: 10 },
  { pattern: "refund", category: OrderStatus.RETUR, priority: 15 },
  { pattern: "pesanan selesai", category: OrderStatus.SELESAI, priority: 18 },
  { pattern: "selesai", category: OrderStatus.SELESAI, priority: 20 },
  { pattern: "telah diterima", category: OrderStatus.SELESAI, priority: 25 },
  { pattern: "perlu dikirim", category: OrderStatus.TRANSIT, priority: 30 },
  { pattern: "sedang dikemas", category: OrderStatus.TRANSIT, priority: 30 },
  { pattern: "sedang dikirim", category: OrderStatus.TRANSIT, priority: 30 },
  { pattern: "dalam pengiriman", category: OrderStatus.TRANSIT, priority: 30 },
  { pattern: "dikemas", category: OrderStatus.TRANSIT, priority: 40 },
  { pattern: "dikirim", category: OrderStatus.TRANSIT, priority: 40 },
  { pattern: "diproses", category: OrderStatus.TRANSIT, priority: 40 },
];

export function normalizeStatus(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Klasifikasi satu teks status mentah Shopee ke kategori internal.
 * Catatan: pembedaan SELESAI vs PENDING_SETTLEMENT ("sudah sampai, belum cair")
 * TIDAK ditentukan di sini — itu diputuskan di upload route berdasarkan ada/tidaknya
 * "Waktu Dana Dilepaskan".
 */
export function classifyStatus(
  rawStatus: string,
  rules: StatusRule[] = DEFAULT_STATUS_RULES,
  fallback: OrderStatus = OrderStatus.TRANSIT
): OrderStatus {
  const s = normalizeStatus(rawStatus);
  if (!s) return fallback;
  const matched = rules
    .filter((r) => s.includes(normalizeStatus(r.pattern)))
    .sort((a, b) => a.priority - b.priority);
  return matched[0]?.category ?? fallback;
}
