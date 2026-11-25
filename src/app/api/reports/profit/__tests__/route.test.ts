import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 nomor 1: baris dengan hppSnapshot = 0 (HPP tidak diketahui) TIDAK boleh dihitung sebagai
// profit. Uang cairnya tetap masuk Uang Cair, tapi dilaporkan terpisah di tanpaHpp.
// @/lib/reconciliation SENGAJA TIDAK di-mock -- reconcile()/allocateActual() asli yang jalan,
// cuma layer Prisma yang di-mock (pola sama dengan test store-performance & recap).
const { getSessionUser, resolveFilters, orderFindMany, incomeEntryFindMany } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  resolveFilters: vi.fn(),
  orderFindMany: vi.fn(),
  incomeEntryFindMany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser }));
vi.mock("@/lib/queryFilters", () => ({ resolveFilters }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: orderFindMany },
    incomeEntry: { findMany: incomeEntryFindMany },
  },
}));

import { GET as profitGET } from "@/app/api/reports/profit/route";
import { GET as topProductsGET } from "@/app/api/dashboard/top-products/route";
import { datasetProfit, datasetBarangKeluar } from "@/lib/reports";

function isReconcileOrderRowsQuery(args: any) {
  return !!args.include?.store;
}
function isAllOrderSnsQuery(args: any) {
  return !!args.select && Object.keys(args.select).length === 1 && args.select.orderSn === true;
}
const fakeReq = (path: string) => ({ url: `http://localhost${path}?storeId=all` }) as unknown as NextRequest;

const FILTER = { storeIds: ["store-1"], from: new Date("2026-08-26"), to: new Date("2026-09-25T23:59:59.999Z") };

// 3 pesanan Selesai, 1 baris SKU masing-masing:
//  SN-A: HPP diketahui (8.000 x 3), sudah cair 66.000      -> profit 42.000
//  SN-B: HPP 0 (tidak di master), sudah cair 50.000         -> tanpaHpp, BUKAN profit 50.000
//  SN-C: HPP 0, BELUM cair                                  -> tidak dihitung sama sekali
const ORDERS = [
  { orderSn: "SN-A", sku: "A", productId: "p-a", productName: "Produk A", qty: 3, grossOmzet: 75000, netSettlement: 66000, hppSnapshot: 8000, profitAgen: 13500 },
  { orderSn: "SN-B", sku: "B", productId: null, productName: "Produk B", qty: 2, grossOmzet: 60000, netSettlement: 50000, hppSnapshot: 0, profitAgen: 30000 },
  { orderSn: "SN-C", sku: "C", productId: null, productName: "Produk C", qty: 1, grossOmzet: 20000, netSettlement: 18000, hppSnapshot: 0, profitAgen: 10000 },
].map((o) => ({ ...o, status: OrderStatus.SELESAI, store: { code: "S1", name: "Toko Satu" } }));

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  resolveFilters.mockResolvedValue(FILTER);
  orderFindMany.mockImplementation((args: any) => {
    if (isReconcileOrderRowsQuery(args)) {
      return Promise.resolve(
        ORDERS.map((o) => ({
          orderSn: o.orderSn,
          store: { code: "S1" },
          productName: o.productName,
          qty: o.qty,
          status: o.status,
          netSettlement: o.netSettlement,
          orderCreatedAt: new Date("2026-09-01"),
          completedAt: null,
          settlementDate: null,
        }))
      );
    }
    if (isAllOrderSnsQuery(args)) return Promise.resolve(ORDERS.map((o) => ({ orderSn: o.orderSn })));
    return Promise.resolve(ORDERS);
  });
  // SN-A & SN-B sudah cair sesuai estimasi; SN-C belum ada di Income Report.
  incomeEntryFindMany.mockResolvedValue(
    [
      { orderSn: "SN-A", amount: 66000 },
      { orderSn: "SN-B", amount: 50000 },
    ].map((e) => ({ ...e, type: "ORDER", releasedAt: new Date("2026-09-10"), import: { createdAt: new Date("2026-09-11") } }))
  );
});

describe("GET /api/reports/profit — baris tanpa HPP tidak dihitung sebagai profit", () => {
  it("summary: Profit HPP hanya dari baris ber-HPP; Uang Cair tetap total; tanpaHpp terpisah", async () => {
    const body = await (await profitGET(fakeReq("/api/reports/profit"))).json();
    expect(body.summary.totalUangCair).toBe(116000); // 66.000 + 50.000 (SN-C belum cair)
    expect(body.summary.totalProfitHpp).toBe(42000); // BUKAN 92.000 (42.000 + 50.000 bug lama)
    expect(body.summary.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
    // Profit Agen & Selisih ikut aturan sama: SN-B & SN-C (HPP 0) tidak dihitung.
    expect(body.summary.totalProfitAgen).toBe(13500);
    expect(body.summary.tanpaHppAgen).toEqual({ baris: 2 });
    expect(body.summary.selisih).toBe(13500 - 42000);
  });

  it("per SKU: baris HPP 0 profit 0 dan punya tanpaHpp sendiri", async () => {
    const body = await (await profitGET(fakeReq("/api/reports/profit"))).json();
    const b = body.rows.find((r: any) => r.name === "Produk B");
    expect(b.uangCair).toBe(50000);
    expect(b.profitHpp).toBe(0);
    expect(b.profitAgen).toBe(0);
    expect(b.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
    const a = body.rows.find((r: any) => r.name === "Produk A");
    expect(a.profitHpp).toBe(42000);
    expect(a.tanpaHpp).toEqual({ baris: 0, uangCair: 0 });
  });
});

describe("export datasetProfit / datasetBarangKeluar", () => {
  it("datasetProfit: total Profit HPP tanpa baris HPP 0 + baris ringkasan Tanpa HPP", async () => {
    const ds = await datasetProfit(FILTER);
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect(sum["Uang Cair Pesanan Periode Ini"]).toBe("Rp 116.000");
    expect(sum["Total Profit HPP (Nett)"]).toBe("Rp 42.000");
    expect(sum["Total Profit Agen"]).toBe("Rp 13.500");
    expect(sum["Tanpa HPP (tidak dihitung ke profit)"]).toBe("1 baris, Rp 50.000");
  });

  it("datasetBarangKeluar: profit per SKU tanpa baris HPP 0", async () => {
    const ds = await datasetBarangKeluar(FILTER);
    const b = ds.rows.find((r: any) => r.produk === "Produk B")!;
    expect(b.profitHpp).toBe(0);
    expect(b.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect(sum["Tanpa HPP (tidak dihitung ke profit)"]).toBe("1 baris, Rp 50.000");
  });
});

describe("GET /api/dashboard/top-products", () => {
  it("Profit HPP per produk tanpa baris HPP 0; total tanpaHpp di respons", async () => {
    const body = await (await topProductsGET(fakeReq("/api/dashboard/top-products"))).json();
    const b = body.all.find((r: any) => r.name === "Produk B");
    expect(b.profitHpp).toBe(0);
    expect(b.uangCair).toBe(50000);
    expect(body.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
  });
});
