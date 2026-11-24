import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

// T-013 butir 15: kolom SKU di export. Order.sku sering kosong (file Pesanan Shopee tanpa SKU).
// Urutan: SKU pesanan -> SKU Master Produk (productId) -> "-". Tidak boleh mengarang SKU.
const { orderFindMany, incomeEntryFindMany } = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  incomeEntryFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: orderFindMany }, incomeEntry: { findMany: incomeEntryFindMany } },
}));

import { exportSku, datasetOrders, datasetProfit, datasetBarangKeluar, datasetCashflow, datasetReturns } from "@/lib/reports";

const F = { storeIds: ["store-1"], from: new Date("2026-07-25T17:00:00Z"), to: new Date("2026-08-25T16:59:59.999Z") };
const base = (over: Record<string, unknown>) => ({
  storeId: "store-1",
  store: { code: "S1", name: "Toko Satu" },
  qty: 1,
  grossOmzet: 10000,
  netSettlement: 9000,
  hppSnapshot: 5000,
  profitAgen: 0,
  returCondition: null,
  orderCreatedAt: new Date("2026-08-01T05:00:00Z"),
  completedAt: null,
  settlementDate: null,
  deletedAt: null,
  ...over,
});
// 3 kasus: SKU di pesanan, SKU hanya di Master Produk, tidak ada SKU sama sekali.
const ROWS = (status: OrderStatus) => [
  base({ orderSn: "SN-1", sku: "SKU-PESANAN", productId: "p1", productName: "Produk 1", product: { sku: "SKU-MASTER-1" }, status }),
  base({ orderSn: "SN-2", sku: "", productId: "p2", productName: "Produk 2", product: { sku: "SKU-MASTER-2" }, status }),
  base({ orderSn: "SN-3", sku: "", productId: null, productName: "Produk 3", product: null, status }),
];
const EXPECTED = { "Produk 1": "SKU-PESANAN", "Produk 2": "SKU-MASTER-2", "Produk 3": "-" };
const skuByProduk = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.produk, r.sku]));

function mockOrders(status: OrderStatus) {
  orderFindMany.mockImplementation((args: any) =>
    Promise.resolve(args?.select && Object.keys(args.select).length === 1 ? [] : ROWS(status))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  incomeEntryFindMany.mockResolvedValue([]);
});

describe("exportSku", () => {
  it("SKU pesanan > SKU master > '-'", () => {
    expect(exportSku({ sku: "A", product: { sku: "M" } })).toBe("A");
    expect(exportSku({ sku: "", product: { sku: "M" } })).toBe("M");
    expect(exportSku({ sku: "  ", product: { sku: " M " } })).toBe("M");
    expect(exportSku({ sku: "", product: null })).toBe("-");
    expect(exportSku({ sku: "", product: { sku: "" } })).toBe("-");
    expect(exportSku({ sku: null })).toBe("-");
  });
});

describe("dataset export memakai exportSku dan meminta SKU master ke Prisma", () => {
  it.each([
    ["Daftar Pesanan", () => datasetOrders(F), OrderStatus.SELESAI],
    ["Laporan Profit", () => datasetProfit(F), OrderStatus.SELESAI],
    ["Barang Keluar", () => datasetBarangKeluar(F), OrderStatus.SELESAI],
    ["Cashflow", () => datasetCashflow(F, "cair"), OrderStatus.SELESAI],
    ["Retur & Pembatalan", () => datasetReturns(F), OrderStatus.RETUR],
  ] as const)("%s: kolom SKU terisi jujur", async (_nama, run, status) => {
    mockOrders(status);
    const ds = await run();
    expect(skuByProduk(ds.rows)).toEqual(EXPECTED);
    // query utama dataset harus menyertakan relasi product.sku
    const mainCall = orderFindMany.mock.calls.find(([a]: any[]) => (a.include ?? a.select)?.product);
    expect(mainCall?.[0].include?.product ?? mainCall?.[0].select?.product).toEqual({ select: { sku: true } });
  });
});
