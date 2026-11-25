import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// T-013 butir 19: periode saat upload dihitung dalam WIB (bukan jam server), dan kunci periode
// memakai key yang SAMA dengan periodKey yang disimpan. Dijalankan di TZ=UTC dan TZ=Asia/Jakarta.
const {
  getSessionUser,
  assertStoreAccess,
  parseShopeeFile,
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
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies: vi.fn() }));
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
import { getPeriodForDateWib, getPeriodForMonth } from "@/lib/period";

const req = () =>
  ({
    formData: async () => ({
      get: (k: string) => (k === "file" ? { name: "p.xlsx", arrayBuffer: async () => new ArrayBuffer(8) } : k === "storeId" ? "store-1" : null),
    }),
  }) as unknown as NextRequest;

const row = (orderSn: string, iso: string) => ({
  orderSn,
  sku: "SKU-A",
  skuInduk: "",
  productName: "Produk A",
  variationName: "",
  qty: 1,
  returnedQty: 0,
  unitPrice: 10000,
  subtotal: 10000,
  totalPayment: 10000,
  netSettlementRaw: 10000,
  adminFee: 0,
  rawStatus: "Selesai",
  settlementColumnPresent: false,
  hasSettlementDate: false,
  orderCreatedAt: new Date(iso),
  completedAt: null,
  settlementDate: null,
  raw: {},
});

// 25 Agu 2026 23:30 WIB = 16:30 UTC; 26 Agu 2026 00:30 WIB = 25 Agu 17:30 UTC (hari UTC yang sama!)
const R25 = row("SN-25", "2026-08-25T16:30:00Z");
const R26 = row("SN-26", "2026-08-25T17:30:00Z");
const KEY_AGU = "2026-07-26_2026-08-25";
const KEY_SEP = "2026-08-26_2026-09-25";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
  periodSettingFindFirst.mockResolvedValue({ cutoffDay: 25 });
  statusMappingFindMany.mockResolvedValue([]);
  productFindMany.mockResolvedValue([]);
  storeFindUnique.mockResolvedValue({ id: "store-1", code: "T01", name: "Toko Satu" });
  periodLockFindUnique.mockResolvedValue(null);
  uploadLogCreate.mockResolvedValue({ id: "log-1" });
  uploadLogUpdate.mockResolvedValue({});
  orderCreate.mockResolvedValue({});
  parseShopeeFile.mockReturnValue({ rows: [R25, R26], errors: [], totalRows: 2 });
});

const savedKeys = () => Object.fromEntries(orderCreate.mock.calls.map(([a]: any[]) => [a.data.orderSn, a.data.periodKey]));

describe("getPeriodForDateWib", () => {
  it("25 jam 23:30 WIB dan 26 jam 00:30 WIB (cut-off 25) masuk periode berbeda, apa pun TZ server", () => {
    expect(getPeriodForDateWib(R25.orderCreatedAt, 25).key).toBe(KEY_AGU);
    expect(getPeriodForDateWib(R26.orderCreatedAt, 25).key).toBe(KEY_SEP);
  });

  it("key sama persis dengan getPeriodForMonth (dipakai resolveFilters & Rekap)", () => {
    expect(getPeriodForDateWib(R26.orderCreatedAt, 25)).toEqual(getPeriodForMonth("2026-09", 25));
  });
});

describe("POST /api/upload — periodKey & kunci periode WIB (T-013 butir 19)", () => {
  it("periodKey yang disimpan = periode WIB", async () => {
    const body = await (await POST(req())).json();
    expect(body.success).toBe(2);
    expect(savedKeys()).toEqual({ "SN-25": KEY_AGU, "SN-26": KEY_SEP });
  });

  it("cek kunci memakai key yang SAMA dengan periodKey yang disimpan", async () => {
    await POST(req());
    const checked = periodLockFindUnique.mock.calls.map(([a]: any[]) => a.where.periodKey);
    expect(checked).toEqual([KEY_AGU, KEY_SEP]);
  });

  it("periode Agustus (WIB) dikunci: pesanan 25 jam 23:30 WIB ditolak, pesanan 26 jam 00:30 WIB tetap masuk", async () => {
    periodLockFindUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.periodKey === KEY_AGU ? { periodKey: KEY_AGU, locked: true } : null)
    );
    const body = await (await POST(req())).json();
    expect(body.skippedLocked).toBe(1);
    expect(savedKeys()).toEqual({ "SN-26": KEY_SEP });
  });

  it("periode September (WIB) dikunci: pesanan 26 jam 00:30 WIB ditolak (dulu di server UTC lolos ke Agustus)", async () => {
    periodLockFindUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.periodKey === KEY_SEP ? { periodKey: KEY_SEP, locked: true } : null)
    );
    const body = await (await POST(req())).json();
    expect(body.skippedLocked).toBe(1);
    expect(savedKeys()).toEqual({ "SN-25": KEY_AGU });
  });

  it("kunci yang dibuka (locked=false) tidak menolak apa pun", async () => {
    periodLockFindUnique.mockResolvedValue({ periodKey: KEY_SEP, locked: false });
    const body = await (await POST(req())).json();
    expect(body.skippedLocked).toBe(0);
    expect(body.success).toBe(2);
  });
});
