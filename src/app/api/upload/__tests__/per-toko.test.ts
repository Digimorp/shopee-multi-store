import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// T-013 batch 21 (bagian C): upload pesanan memakai Master Produk PER TOKO.
// Harness sama dengan idempotent.test.ts (DB di memori, parser di-mock). product.findMany sengaja
// mengembalikan SEMUA produk (abaikan where) supaya terbukti pencocokan sendiri tidak memakai toko lain;
// where yang dikirim route dicek terpisah.
const { getSessionUser, assertStoreAccess, parseShopeeFile, db } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  parseShopeeFile: vi.fn(),
  db: { orders: [] as any[], products: [] as any[], productWhere: [] as any[], seq: 0 },
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/parseShopee", () => ({ parseShopeeFile }));
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: async () => ({ cutoffDay: 25 }) },
    statusMapping: { findMany: async () => [] },
    product: {
      findMany: async (args: any) => {
        db.productWhere.push(args?.where);
        return db.products;
      },
    },
    uploadLog: { create: async () => ({ id: `log-${++db.seq}` }), update: async () => ({}) },
    periodLock: { findUnique: async () => null },
    order: {
      findMany: async ({ where }: any) =>
        db.orders
          .filter((o) => o.storeId === where.storeId && where.orderSn.in.includes(o.orderSn) && o.deletedAt === null)
          .map((o) => ({ ...o })),
      create: async ({ data }: any) => {
        const o = { id: `o-${++db.seq}`, createdAt: db.seq, deletedAt: null, ...data };
        db.orders.push(o);
        return o;
      },
      update: async ({ where, data }: any) => Object.assign(db.orders.find((x) => x.id === where.id), data),
    },
  },
}));

import { POST } from "@/app/api/upload/route";
import { createProductMatcher } from "@/lib/uploadUpsert";

const req = (storeId: string) =>
  ({
    formData: async () => ({
      get: (k: string) => (k === "file" ? { name: "p.xlsx", arrayBuffer: async () => new ArrayBuffer(8) } : k === "storeId" ? storeId : null),
    }),
  }) as unknown as NextRequest;
const row = (o: { orderSn?: string; sku?: string; skuInduk?: string; productName?: string } = {}) => ({
  orderSn: o.orderSn ?? "SN-1",
  sku: o.sku ?? "SKU-A",
  skuInduk: o.skuInduk ?? "",
  productName: o.productName ?? "Produk A",
  variationName: "",
  qty: 1,
  returnedQty: 0,
  unitPrice: 50000,
  subtotal: 50000,
  totalPayment: 50000,
  netSettlementRaw: 50000,
  adminFee: 0,
  rawStatus: "Selesai",
  settlementColumnPresent: false,
  hasSettlementDate: false,
  orderCreatedAt: new Date("2026-09-05T03:00:00Z"),
  completedAt: null,
  settlementDate: null,
  raw: { "No. Pesanan": o.orderSn ?? "SN-1" },
});
async function upload(storeId: string, rows: any[]) {
  assertStoreAccess.mockResolvedValue([storeId]);
  parseShopeeFile.mockReturnValue({ rows, errors: [], totalRows: rows.length });
  return (await POST(req(storeId))).json();
}
const orderOf = (storeId: string) => db.orders.filter((o) => o.storeId === storeId && o.deletedAt === null);
const product = (id: string, storeId: string | null, sku: string, hpp: number, name = "Produk A") => ({ id, storeId, sku, name, hpp, catalogPrice: 60000, isActive: true });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db, { orders: [], products: [], productWhere: [], seq: 0 });
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
});

describe("upload pesanan memakai produk per toko", () => {
  it("route hanya mengambil produk toko ini + produk warisan", async () => {
    await upload("A", [row()]);
    expect(db.productWhere[0]).toEqual({ OR: [{ storeId: "A" }, { storeId: null }] });
  });

  it("dua toko, SKU sama, HPP beda -> profit sesuai tokonya masing-masing", async () => {
    db.products = [product("pa", "A", "SKU-A", 10000), product("pb", "B", "SKU-A", 20000)];
    await upload("A", [row({ orderSn: "SN-A" })]);
    await upload("B", [row({ orderSn: "SN-B" })]);
    expect(orderOf("A")[0]).toMatchObject({ productId: "pa", hppSnapshot: 10000, profitHpp: 40000 });
    expect(orderOf("B")[0]).toMatchObject({ productId: "pb", hppSnapshot: 20000, profitHpp: 30000 });
  });

  it("produk toko LAIN tidak pernah dipakai (SKU, SKU Induk, maupun nama) -> HPP tidak diketahui", async () => {
    db.products = [product("pb", "B", "SKU-A", 20000)];
    await upload("C", [row({ orderSn: "SN-1" }), row({ orderSn: "SN-2", sku: "X", skuInduk: "SKU-A", productName: "Produk A" })]);
    expect(orderOf("C")).toHaveLength(2);
    for (const o of orderOf("C")) {
      expect(o.productId ?? null).toBeNull(); // route lama menulis undefined (= tanpa produk) saat create
      expect(o).toMatchObject({ hppSnapshot: 0, profitHpp: 0 });
    }
  });

  it("cadangan warisan (storeId NULL) dipakai bila toko ini tidak punya produknya", async () => {
    db.products = [product("pl", null, "SKU-A", 15000), product("pb", "B", "SKU-A", 20000)];
    await upload("A", [row()]);
    expect(orderOf("A")[0]).toMatchObject({ productId: "pl", hppSnapshot: 15000, profitHpp: 35000 });
  });

  it("produk toko ini menang atas warisan, termasuk lewat nama", async () => {
    db.products = [product("pl", null, "SKU-A", 15000), product("pa", "A", "SKU-LAIN", 12000, "Produk A")];
    await upload("A", [row()]);
    expect(orderOf("A")[0]).toMatchObject({ productId: "pa", hppSnapshot: 12000 });
  });

  it("upload ulang file yang sama tetap idempoten", async () => {
    db.products = [product("pa", "A", "SKU-A", 10000)];
    const file = [row({ orderSn: "SN-1" }), row({ orderSn: "SN-2" })];
    expect((await upload("A", file)).created).toBe(2);
    const again = await upload("A", file);
    expect([again.created, again.updated, again.unchanged]).toEqual([0, 0, 2]);
    expect(orderOf("A")).toHaveLength(2);
  });
});

describe("createProductMatcher (urutan cocok)", () => {
  const ps = [
    product("a-sku", "A", "S1", 1, "Nama Satu"),
    product("a-induk", "A", "INDUK", 2, "Nama Dua"),
    product("l-sku", null, "S9", 3, "Nama Warisan"),
    product("b-sku", "B", "S7", 4, "Nama Toko B"),
  ];
  const m = createProductMatcher(ps, "A");
  it.each([
    [{ sku: "S1", skuInduk: "", productName: "x" }, "a-sku"],
    [{ sku: "?", skuInduk: "INDUK", productName: "x" }, "a-induk"],
    [{ sku: "?", skuInduk: "", productName: " nama satu " }, "a-sku"],
    [{ sku: "S9", skuInduk: "", productName: "x" }, "l-sku"],
    [{ sku: "?", skuInduk: "", productName: "Nama Warisan" }, "l-sku"],
    [{ sku: "S7", skuInduk: "", productName: "Nama Toko B" }, undefined],
  ])("%o -> %s", (r, id) => {
    expect(m(r)?.id).toBe(id);
  });
});
