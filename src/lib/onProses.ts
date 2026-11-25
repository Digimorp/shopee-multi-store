/**
 * T-013 batch 15 (bagian D): menu On Proses -- pesanan yang BELUM FINAL (Transit dan Belum Cair /
 * PENDING_SETTLEMENT) dari SEMUA periode. Hanya tampilan: data = tabel orders apa adanya, tanpa
 * rumus baru. Omzet = Order.grossOmzet (nilai baris sejak batch 14). Pesanan ini estimasi: TIDAK
 * dihitung di Uang Cair & profit Bulanan sampai statusnya Selesai/cair (upload berikutnya menaikkan
 * statusnya lewat upsert batch 12, lalu pesanan hilang dari daftar ini).
 */
export const ON_PROSES_STATUSES = ["TRANSIT", "PENDING_SETTLEMENT"] as const;
export type OnProsesStatus = (typeof ON_PROSES_STATUSES)[number];
export type AgeBucket = "0-3" | "4-7" | ">7";
export const AGE_BUCKETS: AgeBucket[] = ["0-3", "4-7", ">7"];

export type OnProsesLine = {
  orderSn: string;
  orderCreatedAt: Date;
  storeCode: string;
  productName: string;
  status: string;
  grossOmzet: number;
};
export type OnProsesRow = {
  orderSn: string;
  orderCreatedAt: string;
  storeCode: string;
  productName: string;
  status: OnProsesStatus;
  ageDays: number;
  bucket: AgeBucket;
  omzet: number;
};
export type OnProsesGroup = { status: OnProsesStatus; bucket: AgeBucket; count: number; omzet: number };
export type OnProsesResult = {
  summary: { count: number; omzet: number; oldestDays: number | null };
  groups: OnProsesGroup[];
  rows: OnProsesRow[];
};

const DAY = 86_400_000;
/** Umur = hari penuh sejak pesanan dibuat (0 = kurang dari 24 jam). */
export const ageDays = (created: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY));
export const ageBucket = (days: number): AgeBucket => (days <= 3 ? "0-3" : days <= 7 ? "4-7" : ">7");

// Pesanan multi-baris dengan status berbeda: tampilkan status yang paling belum selesai (Transit).
const RANK: Record<OnProsesStatus, number> = { TRANSIT: 0, PENDING_SETTLEMENT: 1 };

export function buildOnProses(lines: OnProsesLine[], now = new Date()): OnProsesResult {
  const byOrder = new Map<string, OnProsesLine[]>();
  for (const l of lines) {
    if (!(ON_PROSES_STATUSES as readonly string[]).includes(l.status)) continue;
    const key = `${l.storeCode}|${l.orderSn}`;
    const list = byOrder.get(key);
    if (list) list.push(l);
    else byOrder.set(key, [l]);
  }
  const rows: OnProsesRow[] = [];
  for (const list of byOrder.values()) {
    const created = list.reduce((d, l) => (l.orderCreatedAt < d ? l.orderCreatedAt : d), list[0].orderCreatedAt);
    const status = list.reduce<OnProsesStatus>(
      (s, l) => (RANK[l.status as OnProsesStatus] < RANK[s] ? (l.status as OnProsesStatus) : s),
      list[0].status as OnProsesStatus
    );
    const days = ageDays(created, now);
    rows.push({
      orderSn: list[0].orderSn,
      orderCreatedAt: created.toISOString(),
      storeCode: list[0].storeCode,
      productName: list.length > 1 ? `${list[0].productName} +${list.length - 1} lainnya` : list[0].productName,
      status,
      ageDays: days,
      bucket: ageBucket(days),
      omzet: list.reduce((s, l) => s + l.grossOmzet, 0),
    });
  }
  rows.sort((a, b) => b.ageDays - a.ageDays || a.orderSn.localeCompare(b.orderSn));

  const groups: OnProsesGroup[] = [];
  for (const status of ON_PROSES_STATUSES) {
    for (const bucket of AGE_BUCKETS) {
      const hit = rows.filter((r) => r.status === status && r.bucket === bucket);
      groups.push({ status, bucket, count: hit.length, omzet: hit.reduce((s, r) => s + r.omzet, 0) });
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
