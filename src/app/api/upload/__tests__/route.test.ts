import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- mock semua dependency berat sebelum import route (POST) ---
const {
  getSessionUser,
  assertStoreAccess,
  parseShopeeFile,
  analyzeUploadAnomalies,
  periodSettingFindFirst,
  statusMappingFindMany,
  productFindMany,
  storeFindUnique,
  uploadLogCreate,
  uploadLogUpdate,
  periodLockFindUnique,
  orderCreate,
} = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  parseShopeeFile: vi.fn(),
  analyzeUploadAnomalies: vi.fn(),
  periodSettingFindFirst: vi.fn(),
  statusMappingFindMany: vi.fn(),
  productFindMany: vi.fn(),
  storeFindUnique: vi.fn(),
  uploadLogCreate: vi.fn(),
  uploadLogUpdate: vi.fn(),
  periodLockFindUnique: vi.fn(),
  orderCreate: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/parseShopee", () => ({ parseShopeeFile }));
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: periodSettingFindFirst },
    statusMapping: { findMany: statusMappingFindMany },
    product: { findMany: productFindMany },
    store: { findUnique: storeFindUnique },
    uploadLog: { create: uploadLogCreate, update: uploadLogUpdate },
    periodLock: { findUnique: periodLockFindUnique },
    order: { create: orderCreate },
  },
}));

import { POST } from "@/app/api/upload/route";

function makeFakeRequest(): NextRequest {
  const fakeFile = { name: "pesanan.xlsx", arrayBuffer: async () => new ArrayBuffer(8) };
  const fakeFormData = {
    get: (key: string) => (key === "file" ? fakeFile : key === "storeId" ? "store-1" : null),
  };
  return { formData: async () => fakeFormData } as unknown as NextRequest;
}

const sampleRow = {
  orderSn: "SN-1",
  sku: "SKU-A",
  skuInduk: "",
  productName: "Produk A",
  variationName: "",
  qty: 2,
  returnedQty: 0,
  unitPrice: 10000,
  subtotal: 20000,
  totalPayment: 20000,
  netSettlementRaw: 20000,
  adminFee: 0,
  rawStatus: "Selesai",
  settlementColumnPresent: false,
  hasSettlementDate: false,
  orderCreatedAt: new Date("2026-09-01"),
  completedAt: null,
  settlementDate: null,
  raw: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
  periodSettingFindFirst.mockResolvedValue(null);
  statusMappingFindMany.mockResolvedValue([]);
  productFindMany.mockResolvedValue([]);
  storeFindUnique.mockResolvedValue({ id: "store-1", code: "T01", name: "Toko Satu" });
  periodLockFindUnique.mockResolvedValue(null);
  uploadLogCreate.mockResolvedValue({ id: "log-1" });
  uploadLogUpdate.mockResolvedValue({});
  orderCreate.mockResolvedValue({});
  parseShopeeFile.mockReturnValue({ rows: [sampleRow], errors: [], totalRows: 1 });
});

describe("POST /api/upload — AI Anomaly Check dinonaktifkan (T-013)", () => {
  it("analyzeUploadAnomalies tidak dipanggil, order tetap di-create", async () => {
    const res = await POST(makeFakeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(analyzeUploadAnomalies).not.toHaveBeenCalled();
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(body.success).toBe(1);
    expect(body.aiAnomalies).toBeUndefined();
    expect(uploadLogCreate.mock.calls[0][0].data.aiCheckResult).toBeUndefined();
  });
});

describe("POST /api/upload — HPP tidak diketahui (T-013)", () => {
  it("produk tidak ada di master -> HPP tidak dianggap 0: profit 0, productId null, masuk peringatan", async () => {
    productFindMany.mockResolvedValue([]);
    const res = await POST(makeFakeRequest());
    const body = await res.json();

    const data = orderCreate.mock.calls[0][0].data;
    expect(data.productId).toBeUndefined();
    expect(data.hppSnapshot).toBe(0);
    expect(data.profitHpp).toBe(0); // dulu: 20000 - 0 = 20000 (profit palsu sebesar uang cair)
    expect(data.profitAgen).toBe(0);
    expect(body.hppUnknown).toEqual({ rows: 1, products: 1, notInMaster: [{ sku: "SKU-A", rows: 1 }], emptyInMaster: [] });
  });

  it("produk ada di master tapi HPP belum diisi (0) -> diperlakukan sama, masuk daftar emptyInMaster", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: "SKU-A", name: "Produk A", hpp: 0, catalogPrice: 30000 }]);
    const res = await POST(makeFakeRequest());
    const body = await res.json();

    const data = orderCreate.mock.calls[0][0].data;
    expect(data.productId).toBe("p1");
    expect(data.profitHpp).toBe(0);
    expect(data.profitAgen).toBe(0);
    expect(body.hppUnknown).toEqual({ rows: 1, products: 1, notInMaster: [], emptyInMaster: [{ sku: "SKU-A", rows: 1 }] });
  });

  it("daftar SKU HPP tidak diketahui ikut tersimpan ke UploadLog (aiCheckResult), bukan cuma di respons", async () => {
    productFindMany.mockResolvedValue([{ id: "p2", sku: "SKU-B", name: "Produk B", hpp: 0, catalogPrice: 30000 }]);
    parseShopeeFile.mockReturnValue({
      rows: [sampleRow, { ...sampleRow, orderSn: "SN-2" }, { ...sampleRow, orderSn: "SN-3", sku: "SKU-B", productName: "Produk B" }],
      errors: [],
      totalRows: 3,
    });
    await POST(makeFakeRequest());

    expect(uploadLogUpdate).toHaveBeenCalledTimes(1);
    const saved = uploadLogUpdate.mock.calls[0][0].data.aiCheckResult;
    expect(saved.source).toBe("hpp-check");
    expect(saved.hppUnknown).toEqual({
      rows: 3,
      products: 2,
      notInMaster: [{ sku: "SKU-A", rows: 2 }],
      emptyInMaster: [{ sku: "SKU-B", rows: 1 }],
    });
    expect(saved.summary).toContain("3 baris HPP tidak diketahui");
    // kompatibel dengan pembaca lama aiCheckResult
    expect(saved.anomalies).toEqual([]);
  });

  it("produk dengan HPP terisi -> profit dihitung normal, tidak ada peringatan", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: "SKU-A", name: "Produk A", hpp: 5000, catalogPrice: 30000 }]);
    const res = await POST(makeFakeRequest());
    const body = await res.json();

    const data = orderCreate.mock.calls[0][0].data;
    expect(data.hppSnapshot).toBe(5000);
    expect(data.profitHpp).toBeGreaterThan(0);
    expect(body.hppUnknown.rows).toBe(0);
    expect(body.hppUnknown.products).toBe(0);
    expect(uploadLogUpdate.mock.calls[0][0].data.aiCheckResult.hppUnknown.rows).toBe(0);
  });

  it("batch4 I: file tanpa SKU -> produk unik tanpa HPP dihitung per nama produk, dari baris file ini saja", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: "SKU-X", name: "Produk Ber-HPP", hpp: 5000, catalogPrice: 30000 }]);
    const noSku = { ...sampleRow, sku: "", skuInduk: "" };
    parseShopeeFile.mockReturnValue({
      rows: [
        { ...noSku, orderSn: "SN-1", productName: "Produk Satu" },
        { ...noSku, orderSn: "SN-2", productName: "Produk Satu" },
        { ...noSku, orderSn: "SN-3", productName: "Produk Dua" },
        { ...noSku, orderSn: "SN-4", productName: "Produk Ber-HPP" },
      ],
      errors: [],
      totalRows: 4,
    });
    const res = await POST(makeFakeRequest());
    const body = await res.json();

    expect(res.status).toBe(200); // upload tidak diblokir
    expect(orderCreate).toHaveBeenCalledTimes(4);
    expect(body.hppUnknown.rows).toBe(3);
    expect(body.hppUnknown.products).toBe(2);
    expect(body.hppUnknown.notInMaster).toEqual([
      { sku: "Produk Satu", rows: 2 },
      { sku: "Produk Dua", rows: 1 },
    ]);
    // arti HPP 0 tetap "tidak diketahui": profit baris itu 0
    const tanpaHpp = orderCreate.mock.calls.map((c: any[]) => c[0].data).filter((d: any) => d.hppSnapshot === 0);
    expect(tanpaHpp).toHaveLength(3);
    expect(tanpaHpp.every((d: any) => d.profitHpp === 0 && d.profitAgen === 0)).toBe(true);
  });
});
