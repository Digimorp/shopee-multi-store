import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// --- mock dependency berat sebelum import route (GET). @/lib/reconciliation SENGAJA
// TIDAK di-mock -- test ini harus menjalankan reconcile()/buildActualLookup()/
// allocateActual() ASLI (hasil fix), cuma layer I/O Prisma-nya yang di-mock. ---
const { getSessionUser, resolveFilters, storeFindMany, orderFindMany, incomeEntryFindMany } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  resolveFilters: vi.fn(),
  storeFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  incomeEntryFindMany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser }));
vi.mock("@/lib/queryFilters", () => ({ resolveFilters }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findMany: storeFindMany },
    order: { findMany: orderFindMany },
    incomeEntry: { findMany: incomeEntryFindMany },
  },
}));

import { GET } from "@/app/api/reports/store-performance/route";

/** reconcile() punya 2 query order.findMany berbeda dari storePerformanceRows() sendiri —
 * dibedakan lewat bentuk args, bukan urutan panggilan (lebih tahan terhadap refactor). */
function isReconcileOrderRowsQuery(args: any) {
  return !!args.include?.store;
}
function isAllOrderSnsQuery(args: any) {
  return !!args.select && Object.keys(args.select).length === 1 && args.select.orderSn === true;
}

function fakeReq(): NextRequest {
  return { url: "http://localhost/api/reports/store-performance?storeId=all" } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  resolveFilters.mockResolvedValue({
    storeIds: ["store-1"],
    from: new Date("2026-08-26"),
    to: new Date("2026-09-25T23:59:59.999Z"),
  });
  storeFindMany.mockResolvedValue([{ id: "store-1", code: "S1", name: "Toko Satu" }]);

  orderFindMany.mockImplementation((args: any) => {
    if (isReconcileOrderRowsQuery(args)) {
      // reconcile() -- orderRows dalam rentang periode
      return Promise.resolve([
        {
          orderSn: "SN-X",
          store: { code: "S1" },
          productName: "Produk X",
          qty: 2,
          status: OrderStatus.SELESAI,
          netSettlement: 90000,
          orderCreatedAt: new Date("2026-09-01"),
          completedAt: null,
          settlementDate: null,
        },
        {
          orderSn: "SN-Y",
          store: { code: "S1" },
          productName: "Produk Y",
          qty: 1,
          status: OrderStatus.SELESAI,
          netSettlement: 45000,
          orderCreatedAt: new Date("2026-09-02"),
          completedAt: null,
          settlementDate: null,
        },
      ]);
    }
    if (isAllOrderSnsQuery(args)) {
      return Promise.resolve([{ orderSn: "SN-X" }, { orderSn: "SN-Y" }]);
    }
    // storePerformanceRows() -- query miliknya sendiri
    return Promise.resolve([
      {
        storeId: "store-1",
        orderSn: "SN-X",
        status: OrderStatus.SELESAI,
        qty: 2,
        grossOmzet: 100000,
        netSettlement: 90000,
        hppSnapshot: 5000,
        profitAgen: 5000,
      },
      {
        storeId: "store-1",
        orderSn: "SN-Y",
        status: OrderStatus.SELESAI,
        qty: 1,
        grossOmzet: 50000,
        netSettlement: 45000,
        hppSnapshot: 5000,
        profitAgen: 2000,
      },
    ]);
  });

  // Hanya SN-X yang sudah match ke Income Report (SN-Y belum cair -> "Menunggu Cair").
  incomeEntryFindMany.mockResolvedValue([
    {
      type: "ORDER",
      orderSn: "SN-X",
      amount: 80000,
      releasedAt: new Date("2026-09-10"),
      import: { createdAt: new Date("2026-09-11") },
    },
  ]);
});

describe("GET /api/reports/store-performance — regresi bug Uang Cair/Profit HPP pakai Estimasi", () => {
  it("Uang Cair & Profit HPP pakai nilai AKTUAL; order belum match di-exclude (bukan dihitung penuh)", async () => {
    const res = await GET(fakeReq());
    const body = await res.json();
    const row = body.rows.find((r: any) => r.toko === "S1 - Toko Satu");

    expect(row).toBeDefined();
    expect(row.omzet).toBe(150000); // 100.000 + 50.000 -- agregasi omzet tidak berubah
    expect(row.uangCair).toBe(80000); // hanya SN-X (aktual match); SN-Y (belum cair) di-exclude
    expect(row.uangCair).not.toBe(row.omzet); // bukti bug lama (uangCair == omzet) sudah tidak terjadi
    expect(row.profitHpp).toBe(80000 - 5000 * 2); // 70.000 = aktual SN-X - hppSnapshot*qty, SN-Y tidak ikut
  });
});
