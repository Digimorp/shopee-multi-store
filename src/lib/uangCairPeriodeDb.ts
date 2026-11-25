import { prisma } from "@/lib/prisma";
import { chunk } from "@/lib/uploadUpsert";
import {
  summarizeUangCair,
  summarizeUangCairPerBulan,
  type UangCairEntry,
  type UangCairRincian,
} from "@/lib/uangCairPeriode";

/**
 * T-013 batch 13 (tugas X): ambil data untuk "Uang Cair periode" (rumus di src/lib/uangCairPeriode.ts).
 * - storeIds WAJIB hasil resolveFilters/assertStoreAccess (hak akses toko): Admin Toko hanya
 *   melihat entri toko miliknya.
 * - Hanya import AKTIF: tidak di-soft-delete dan tidak di-supersede (re-import periode yang sama
 *   menandai import lama isSuperseded -- sama dengan reconcile()), jadi entri tidak terhitung ganda.
 */
async function loadEntries(storeIds: string[], range?: { from: Date; to: Date }): Promise<UangCairEntry[]> {
  if (storeIds.length === 0) return [];
  const rows = await prisma.incomeEntry.findMany({
    where: {
      storeId: { in: storeIds },
      import: { isSuperseded: false, deletedAt: null },
      ...(range
        ? {
            OR: [
              { releasedAt: { gte: range.from, lte: range.to } },
              { releasedAt: null, import: { createdAt: { gte: range.from, lte: range.to } } },
            ],
          }
        : {}),
    },
    select: {
      storeId: true,
      type: true,
      orderSn: true,
      amount: true,
      releasedAt: true,
      import: { select: { createdAt: true, deletedAt: true, isSuperseded: true } },
    },
  });
  // Filter ulang di memori (aman kalau query di atas dilonggarkan / di-mock).
  return (rows as any[])
    .filter((e) => storeIds.includes(e.storeId) && !e.import?.deletedAt && !e.import?.isSuperseded)
    .map((e) => ({
      storeId: e.storeId,
      type: e.type,
      orderSn: e.orderSn ?? null,
      amount: Number(e.amount) || 0,
      releasedAt: e.releasedAt ?? null,
      importCreatedAt: e.import?.createdAt ?? new Date(0),
    }));
}

/** No. Pesanan -> tanggal pesanan dibuat paling awal (pesanan aktif di toko-toko itu). */
async function loadOrderDates(storeIds: string[], entries: UangCairEntry[]): Promise<Map<string, Date>> {
  const sns = [...new Set(entries.filter((e) => e.amount > 0 && e.orderSn).map((e) => e.orderSn as string))];
  const out = new Map<string, Date>();
  for (const part of chunk(sns, 1000)) {
    const rows = await prisma.order.findMany({
      where: { storeId: { in: storeIds }, orderSn: { in: part }, deletedAt: null },
      select: { orderSn: true, orderCreatedAt: true },
    });
    const wanted = new Set(part);
    for (const o of rows as { orderSn: string; orderCreatedAt: Date }[]) {
      if (!wanted.has(o.orderSn) || !o.orderCreatedAt) continue;
      const cur = out.get(o.orderSn);
      if (!cur || o.orderCreatedAt < cur) out.set(o.orderSn, o.orderCreatedAt);
    }
  }
  return out;
}

export type UangCairPeriode = UangCairRincian & { byStore: Record<string, UangCairRincian> };

/** Uang Cair periode untuk filter (toko yang boleh diakses + rentang periode WIB). */
export async function getUangCairPeriode(f: { storeIds: string[]; from: Date; to: Date }): Promise<UangCairPeriode> {
  const entries = await loadEntries(f.storeIds, { from: f.from, to: f.to });
  const orderDates = await loadOrderDates(f.storeIds, entries);
  const { all, byStore } = summarizeUangCair(entries, f.from, f.to, orderDates);
  return { ...all, byStore };
}

/** Uang Cair per bulan periode cut-off (semua bulan) -- Rekap Bulanan/Tahunan. */
export async function getUangCairPerBulan(storeIds: string[], cutoffDay: number): Promise<Map<string, UangCairRincian>> {
  const entries = await loadEntries(storeIds);
  const orderDates = await loadOrderDates(storeIds, entries);
  return summarizeUangCairPerBulan(entries, orderDates, cutoffDay);
}
