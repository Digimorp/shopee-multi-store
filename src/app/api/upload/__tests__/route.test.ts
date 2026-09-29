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

describe("POST /api/upload — commit tetap jalan terlepas dari hasil AI Anomaly Check", () => {
  it("AI check gagal/di-skip (fail-open) -> order tetap di-create, response tetap sukses", async () => {
    analyzeUploadAnomalies.mockResolvedValue({
      anomalies: [],
      summary: "Pemeriksaan AI gagal dijalankan (network/rate limit). Data tetap tersimpan seperti biasa.",
      aiCheckSkipped: true,
    });

    const res = await POST(makeFakeRequest());
    const body = await res.json();

    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(uploadLogCreate).toHaveBeenCalledTimes(1);
    expect(body.success).toBe(1);
    expect(body.aiCheckSkipped).toBe(true);
    expect(body.aiAnomalies).toEqual([]);
  });

  it("AI check sukses dengan anomali -> order tetap di-create sama seperti biasa, anomali ikut di response", async () => {
    analyzeUploadAnomalies.mockResolvedValue({
      anomalies: [{ severity: "high", rowRef: "SN-1", field: "unitPrice", message: "Harga tidak wajar." }],
      summary: "Ditemukan 1 anomali harga.",
      aiCheckSkipped: false,
    });

    const res = await POST(makeFakeRequest());
    const body = await res.json();

    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(body.success).toBe(1);
    expect(body.aiAnomalies).toHaveLength(1);
    expect(body.aiCheckSkipped).toBe(false);
  });

  it("response status tetap 200 dan commit tetap terjadi walau hasil AI check aiCheckSkipped=true", async () => {
    analyzeUploadAnomalies.mockResolvedValue({
      anomalies: [],
      summary: "Pemeriksaan AI dilewati (ANTHROPIC_API_KEY belum diset). Data tetap tersimpan seperti biasa.",
      aiCheckSkipped: true,
    });

    const res = await POST(makeFakeRequest());
    expect(res.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
  });
});
