import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 nomor 1 (langkah C): Dashboard (summary, trend) dan export daftar pesanan TIDAK lagi
// memakai kolom Order.profitHpp/profitAgen tersimpan -- rumus sama dengan Laporan Profit:
// uang cair AKTUAL (reconcile + allocateActual), baris HPP 0 tidak masuk profit (tanpaHpp).
// @/lib/reconciliation SENGAJA TIDAK di-mock; cuma layer Prisma yang di-mock.
const { getSessionUser, resolveFilters, orderFindMany, orderAggregate, incomeEntryFindMany } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  resolveFilters: vi.fn(),
  orderFindMany: vi.fn(),
  orderAggregate: vi.fn(),
  incomeEntryFindMany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser }));
vi.mock("@/lib/queryFilters", () => ({ resolveFilters }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: orderFindMany, aggregate: orderAggregate },
    incomeEntry: { findMany: incomeEntryFindMany },
  },
}));

import { GET as summaryGET } from "@/app/api/dashboard/summary/route";
import { GET as trendGET } from "@/app/api/dashboard/trend/route";
import { GET as profitGET } from "@/app/api/reports/profit/route";
import { datasetOrders } from "@/lib/reports";

function isAllOrderSnsQuery(args: any) {
  return !!args.select && Object.keys(args.select).length === 1 && args.select.orderSn === true;
}
const fakeReq = (path: string) => ({ url: `http://localhost${path}?storeId=all` }) as unknown as NextRequest;
const FILTER = { storeIds: ["store-1"], from: new Date("2026-08-26"), to: new Date("2026-09-25T23:59:59.999Z") };

// Kolom profitHpp/profitAgen TERSIMPAN sengaja diisi nilai "salah" (gaya data lama: HPP 0 ->
// profit penuh) supaya test membuktikan kolom itu tidak dipakai lagi.
//  SN-A: Selesai, HPP 8.000 x 3, cair 66.000       -> profit 42.000
//  SN-B: Selesai, HPP 0, cair 50.000               -> tanpaHpp (BUKAN profit 50.000)
//  SN-C: Selesai, HPP 0, BELUM cair                -> tidak dihitung
//  SN-D: Belum Cair (pending), HPP 5.000           -> hanya Profit Agen 4.000
const ORDERS = [
  { orderSn: "SN-A", productName: "Produk A", sku: "A", productId: "p-a", qty: 3, grossOmzet: 75000, netSettlement: 66000, hppSnapshot: 8000, profitHpp: 42000, profitAgen: 13500, status: OrderStatus.SELESAI, day: "2026-09-01" },
  { orderSn: "SN-B", productName: "Produk B", sku: "B", productId: null, qty: 2, grossOmzet: 60000, netSettlement: 50000, hppSnapshot: 0, profitHpp: 50000, profitAgen: 30000, status: OrderStatus.SELESAI, day: "2026-09-01" },
  { orderSn: "SN-C", productName: "Produk C", sku: "C", productId: null, qty: 1, grossOmzet: 20000, netSettlement: 18000, hppSnapshot: 0, profitHpp: 18000, profitAgen: 10000, status: OrderStatus.SELESAI, day: "2026-09-02" },
  { orderSn: "SN-D", productName: "Produk D", sku: "D", productId: "p-d", qty: 1, grossOmzet: 15000, netSettlement: 12000, hppSnapshot: 5000, profitHpp: 0, profitAgen: 4000, status: OrderStatus.PENDING_SETTLEMENT, day: "2026-09-03" },
].map(({ day, ...o }) => ({
  ...o,
  storeId: "store-1",
  store: { code: "S1", name: "Toko Satu" },
  orderCreatedAt: new Date(`${day}T05:00:00Z`),
  completedAt: null,
  settlementDate: null,
  deletedAt: null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  resolveFilters.mockResolvedValue(FILTER);
  orderFindMany.mockImplementation((args: any) => {
    if (isAllOrderSnsQuery(args)) return Promise.resolve(ORDERS.map((o) => ({ orderSn: o.orderSn })));
    const st = args.where?.status;
    const rows = ORDERS.filter((o) => {
      if (!st) return true;
      if (typeof st === "string") return o.status === st;
      if (st.in) return st.in.includes(o.status);
      if (st.not) return o.status !== st.not;
      return true;
    });
    return Promise.resolve(rows);
  });
  orderAggregate.mockResolvedValue({ _sum: { grossOmzet: 0, netSettlement: 0 } });
  incomeEntryFindMany.mockResolvedValue(
    [
      { orderSn: "SN-A", amount: 66000 },
      { orderSn: "SN-B", amount: 50000 },
    ].map((e) => ({ ...e, type: "ORDER", releasedAt: new Date("2026-09-10"), import: { createdAt: new Date("2026-09-11") } }))
  );
});

describe("GET /api/dashboard/summary", () => {
  it("Profit HPP/Agen tanpa baris HPP 0 (bukan dari kolom tersimpan); tanpaHpp terpisah", async () => {
    const body = await (await summaryGET(fakeReq("/api/dashboard/summary"))).json();
    expect(body.profitHpp).toBe(42000); // BUKAN 110.000 (jumlah kolom profitHpp tersimpan SN-A..C)
    expect(body.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
    expect(body.profitAgen).toBe(13500 + 4000); // SN-A + SN-D; SN-B & SN-C (HPP 0) tidak dihitung
    expect(body.tanpaHppAgen).toEqual({ baris: 2 });
  });

  it("angkanya sama dengan Laporan Profit untuk data yang sama", async () => {
    const dash = await (await summaryGET(fakeReq("/api/dashboard/summary"))).json();
    const lap = await (await profitGET(fakeReq("/api/reports/profit"))).json();
    expect(dash.profitHpp).toBe(lap.summary.totalProfitHpp);
    expect(dash.profitAgen).toBe(lap.summary.totalProfitAgen);
    expect(dash.tanpaHpp).toEqual(lap.summary.tanpaHpp);
    expect(dash.tanpaHppAgen).toEqual(lap.summary.tanpaHppAgen);
  });
});

describe("GET /api/dashboard/trend", () => {
  it("profit per tanggal tanpa baris HPP 0; tanpaHpp per tanggal & total", async () => {
    const body = await (await trendGET(fakeReq("/api/dashboard/trend"))).json();
    const d1 = body.trend.find((p: any) => p.date === "2026-09-01");
    expect(d1.omzet).toBe(135000); // omzet tidak berubah: 75.000 + 60.000
    expect(d1.profit).toBe(42000); // BUKAN 92.000
    expect(d1.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
    const d2 = body.trend.find((p: any) => p.date === "2026-09-02");
    expect(d2.profit).toBe(0); // SN-C belum cair -> tidak dihitung, bukan 18.000 tersimpan
    expect(d2.tanpaHpp).toEqual({ baris: 0, uangCair: 0 });
    expect(body.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
  });
});

describe("export datasetOrders", () => {
  it("per baris: uang cair aktual, profit 0 + tanda tanpaHpp untuk HPP 0; ringkasan Tanpa HPP", async () => {
    const ds = await datasetOrders(FILTER);
    const row = (sn: string) => ds.rows.find((r: any) => r.noPesanan === sn)!;
    expect(row("SN-A")).toMatchObject({ uangCair: 66000, profitHpp: 42000, profitAgen: 13500, tanpaHpp: false });
    expect(row("SN-B")).toMatchObject({ uangCair: 50000, profitHpp: 0, profitAgen: 0, tanpaHpp: true });
    expect(row("SN-C")).toMatchObject({ uangCair: 0, profitHpp: 0, profitAgen: 0, tanpaHpp: false }); // belum cair
    expect(row("SN-D")).toMatchObject({ uangCair: 0, profitHpp: 0, profitAgen: 4000 });
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect(sum["Total profit HPP"]).toBe("Rp 42.000");
    expect(sum["Tanpa HPP (tidak dihitung ke profit)"]).toBe("1 baris, Rp 50.000");
  });
});
