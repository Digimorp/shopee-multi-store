import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { ageBucket, ageDays, onProsesGroupOf } from "@/lib/onProses";

// T-013 batch 16 (B): On Proses lewat API sungguhan + reconcile() Rekonsiliasi asli, DB tiruan di memori.
const { getSessionUser, assertStoreAccess, db } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  db: { orders: [] as any[], entries: [] as any[] },
}));
vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/prisma", () => {
  const STORES: Record<string, string> = { s1: "TOKO1", s2: "TOKO2" };
  const matchOrder = (o: any, w: any) =>
    w.storeId.in.includes(o.storeId) &&
    o.deletedAt == null &&
    (!w.orderCreatedAt || (o.orderCreatedAt >= w.orderCreatedAt.gte && o.orderCreatedAt <= w.orderCreatedAt.lte)) &&
    (!w.status?.not || o.status !== w.status.not) &&
    (!w.orderSn?.in || w.orderSn.in.includes(o.orderSn));
  return {
    prisma: {
      order: {
        findMany: async ({ where }: any) =>
          db.orders.filter((o) => matchOrder(o, where)).map((o) => ({ ...o, store: { code: STORES[o.storeId] } })),
      },
      incomeEntry: {
        findMany: async ({ where }: any) =>
          db.entries
            .filter((e) => where.storeId.in.includes(e.storeId) && !e.superseded)
            .map((e) => ({ ...e, import: { createdAt: new Date("2026-11-01T00:00:00Z") } })),
      },
    },
  };
});

import { GET } from "@/app/api/on-proses/route";

const NOW = Date.now();
const created = (days: number) => new Date(NOW - days * 86_400_000 - 3_600_000);
const order = (sn: string, status: string, days: number, storeId = "s1", grossOmzet = 10000) => ({
  orderSn: sn, storeId, status, productName: `P-${sn}`, qty: 1, netSettlement: grossOmzet, grossOmzet,
  orderCreatedAt: created(days), completedAt: null, settlementDate: null, deletedAt: null,
});
const income = (sn: string, storeId = "s1", superseded = false) => ({
  orderSn: sn, storeId, type: "ORDER", amount: 9000, releasedAt: new Date(), description: "Penghasilan", superseded,
});
const call = async (storeIds: string[]) => {
  assertStoreAccess.mockResolvedValue(storeIds);
  const res = await GET({ url: "http://x/api/on-proses?storeId=all" } as NextRequest);
  return res.json();
};

beforeEach(() => {
  getSessionUser.mockResolvedValue({ id: "u", role: "OWNER", storeIds: [] });
  db.orders = [];
  db.entries = [];
});

describe("On Proses: Dalam pengiriman + Selesai, belum cair", () => {
  it("Selesai tanpa income muncul; Transit muncul; Batal/Retur tidak; PENDING lama ikut kelompok 2", async () => {
    db.orders = [
      order("A", "SELESAI", 40, "s1", 50000),
      order("B", "TRANSIT", 2),
      order("C", "CANCEL", 1),
      order("D", "RETUR", 5),
      order("E", "PENDING_SETTLEMENT", 6),
      order("F", "SELESAI", 3), // sudah cair
    ];
    db.entries = [income("F")];
    const r = await call(["s1"]);
    expect(r.rows.map((x: any) => `${x.orderSn}:${x.group}`).sort()).toEqual(["A:BELUM_CAIR", "B:DIKIRIM", "E:BELUM_CAIR"]);
    expect(r.summary).toEqual({ count: 3, omzet: 70000, oldestDays: 40 });
    const g = Object.fromEntries(r.groups.filter((x: any) => x.count).map((x: any) => [`${x.group}|${x.bucket}`, x.count]));
    expect(g).toEqual({ "DIKIRIM|0-3": 1, "BELUM_CAIR|4-7": 1, "BELUM_CAIR|>7": 1 });
  });

  it("setelah Income-nya diimport, pesanan keluar; import superseded tidak dihitung", async () => {
    db.orders = [order("A", "SELESAI", 10)];
    db.entries = [income("A", "s1", true)];
    expect((await call(["s1"])).summary.count).toBe(1);
    db.entries.push(income("A"));
    expect((await call(["s1"])).summary).toEqual({ count: 0, omzet: 0, oldestDays: null });
  });

  it("antar toko tidak bocor", async () => {
    db.orders = [order("A", "SELESAI", 10, "s1"), order("Z", "SELESAI", 10, "s2"), order("Y", "TRANSIT", 1, "s2")];
    const r = await call(["s1"]);
    expect(r.rows.map((x: any) => `${x.storeCode}:${x.orderSn}`)).toEqual(["TOKO1:A"]);
  });

  it("umur & kelompok", () => {
    expect([0, 3, 4, 7, 8].map(ageBucket)).toEqual(["0-3", "0-3", "4-7", "4-7", ">7"]);
    expect(ageDays(new Date(NOW), new Date(NOW))).toBe(0);
    expect(onProsesGroupOf({ status: "SELESAI", category: "MATCH", side: "both" })).toBeNull();
    expect(onProsesGroupOf({ status: "SELESAI", category: "BELUM_KETEMU", side: "income" })).toBeNull();
  });
});
