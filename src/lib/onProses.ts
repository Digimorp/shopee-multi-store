/**
 * T-013 batch 15 (D) + batch 16 (B): menu On Proses -- pesanan yang uangnya BELUM masuk, dari SEMUA
 * periode, dalam 2 kelompok:
 *   1. "Dalam pengiriman"     = status TRANSIT.
 *   2. "Selesai, belum cair"  = pesanan Selesai (atau PENDING_SETTLEMENT lama) yang BELUM punya entri
 *      Income aktif. Penentuannya TIDAK ditulis ulang di sini: memakai hasil reconcile() Rekonsiliasi
 *      (category BELUM_KETEMU sisi pesanan), jadi definisinya selalu sama dengan Rekonsiliasi.
 * Pesanan keluar otomatis saat entri Income-nya masuk (reconcile jadi MATCH/SELISIH). Batal/Retur
 * tidak pernah masuk. Hanya tampilan: tanpa rumus/schema baru. Omzet = Omzet Pesanan (grossOmzet).
 */
export const ON_PROSES_GROUPS = ["DIKIRIM", "BELUM_CAIR"] as const;
export type OnProsesGroupKey = (typeof ON_PROSES_GROUPS)[number];
export const ON_PROSES_GROUP_LABEL: Record<OnProsesGroupKey, string> = {
  DIKIRIM: "Dalam pengiriman",
  BELUM_CAIR: "Selesai, belum cair",
};
export type AgeBucket = "0-3" | "4-7" | ">7";
export const AGE_BUCKETS: AgeBucket[] = ["0-3", "4-7", ">7"];

/** Bagian ReconItem (src/lib/reconciliation.ts) yang dipakai di sini. */
export type ReconLike = {
  orderSn: string;
  storeCode: string;
  productName: string;
  status: string;
  category: string;
  side: string;
  orderCreatedAt: string | null;
};
export type OnProsesRow = {
  orderSn: string;
  orderCreatedAt: string;
  storeCode: string;
  productName: string;
  group: OnProsesGroupKey;
  ageDays: number;
  bucket: AgeBucket;
  omzet: number;
};
export type OnProsesGroup = { group: OnProsesGroupKey; bucket: AgeBucket; count: number; omzet: number };
export type OnProsesResult = {
  summary: { count: number; omzet: number; oldestDays: number | null };
  groups: OnProsesGroup[];
  rows: OnProsesRow[];
};

const DAY = 86_400_000;
/** Umur = hari penuh sejak pesanan dibuat (0 = kurang dari 24 jam). */
export const ageDays = (created: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY));
export const ageBucket = (days: number): AgeBucket => (days <= 3 ? "0-3" : days <= 7 ? "4-7" : ">7");

/** Kelompok On Proses untuk satu item Rekonsiliasi; null = bukan On Proses. */
export function onProsesGroupOf(item: Pick<ReconLike, "status" | "category" | "side">): OnProsesGroupKey | null {
  if (item.status === "TRANSIT") return "DIKIRIM";
  // Selesai/PENDING_SETTLEMENT tanpa entri Income aktif (definisi Rekonsiliasi).
  if (item.category === "BELUM_KETEMU" && item.side === "order") return "BELUM_CAIR";
  return null;
}

/**
 * @param items hasil reconcile() lintas semua periode
 * @param omzetBySn Omzet Pesanan per `${storeCode}|${orderSn}` (jumlah grossOmzet baris pesanan)
 */
export function buildOnProses(items: ReconLike[], omzetBySn: Map<string, number>, now = new Date()): OnProsesResult {
  const rows: OnProsesRow[] = [];
  for (const it of items) {
    const group = onProsesGroupOf(it);
    if (!group || !it.orderCreatedAt) continue;
    const days = ageDays(new Date(it.orderCreatedAt), now);
    rows.push({
      orderSn: it.orderSn,
      orderCreatedAt: it.orderCreatedAt,
      storeCode: it.storeCode,
      productName: it.productName,
      group,
      ageDays: days,
      bucket: ageBucket(days),
      omzet: omzetBySn.get(`${it.storeCode}|${it.orderSn}`) ?? 0,
    });
  }
  rows.sort((a, b) => b.ageDays - a.ageDays || a.orderSn.localeCompare(b.orderSn));

  const groups: OnProsesGroup[] = [];
  for (const group of ON_PROSES_GROUPS) {
    for (const bucket of AGE_BUCKETS) {
      const hit = rows.filter((r) => r.group === group && r.bucket === bucket);
      groups.push({ group, bucket, count: hit.length, omzet: hit.reduce((s, r) => s + r.omzet, 0) });
    }
  }
  return {
    summary: {
      count: rows.length,
      omzet: rows.reduce((s, r) => s + r.omzet, 0),
      oldestDays: rows.length ? rows[0].ageDays : null,
    },
    groups,
    rows,
  };
}
