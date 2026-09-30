import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// --- mock dependency berat sebelum import route (GET). @/lib/reconciliation SENGAJA
// TIDAK di-mock -- test ini harus menjalankan reconcile()/buildActualLookup()/
// allocateActual() ASLI (hasil fix), cuma layer I/O Prisma-nya yang di-mock. ---
const { getSessionUser, assertStoreAccess, periodSettingFindFirst, orderFindMany, incomeEntryFindMany } = vi.hoisted(
  () => ({
    getSessionUser: vi.fn(),
    assertStoreAccess: vi.fn(),
    periodSettingFindFirst: vi.fn(),
    orderFindMany: vi.fn(),
    incomeEntryFindMany: vi.fn(),
  })
);

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess, getAccessibleStoreIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: periodSettingFindFirst },
    order: { findMany: orderFindMany },
    incomeEntry: { findMany: incomeEntryFindMany },
  },
}));

import { GET } from "@/app/api/reports/recap/route";

const PERIOD_KEY = "2026-08-26_2026-09-25";

/** reconcile() punya 2 query order.findMany berbeda dari query milik route recap sendiri —
 * dibedakan lewat bentuk args, bukan urutan panggilan (lebih tahan terhadap refactor). */
function isReconcileOrderRowsQuery(args: any) {
  return !!args.include?.store;
}
function isAllOrderSnsQuery(args: any) {
  return !!args.select && Object.keys(args.select).length === 1 && args.select.orderSn === true;
}

function fakeReq(qs: string): NextRequest {
  return { url: `http://localhost/api/reports/recap?${qs}` } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
  periodSettingFindFirst.mockResolvedValue({ cutoffDay: 25 });

  orderFindMany.mockImplementation((args: any) => {
    if (isReconcileOrderRowsQuery(args)) {
      // reconcile() -- orderRows (dipanggil dgn rentang tanggal seluas mungkin utk rekap)
      return Promise.resolve([
        {
          orderSn: "SN-M",
          store: { code: "S1" },
          productName: "Produk M",
          qty: 2,
          status: OrderStatus.SELESAI,
          netSettlement: 180000,
          orderCreatedAt: new Date("2026-09-01"),
          completedAt: null,
          settlementDate: null,
        },
        {
          orderSn: "SN-N",
          store: { code: "S1" },
          productName: "Produk N",
          qty: 1,
          status: OrderStatus.SELESAI,
          netSettlement: 90000,
          orderCreatedAt: new Date("2026-09-02"),
          completedAt: null,
          settlementDate: null,
        },
      ]);
    }
    if (isAllOrderSnsQuery(args)) {
      return Promise.resolve([{ orderSn: "SN-M" }, { orderSn: "SN-N" }]);
    }
    // route recap -- query miliknya sendiri (semua periode, tanpa filter tanggal)
    return Promise.resolve([
      {
        orderSn: "SN-M",
        orderCreatedAt: new Date("2026-09-01"),
        grossOmzet: 200000,
        netSettlement: 180000,
        hppSnapshot: 20000,
        qty: 2,
        status: OrderStatus.SELESAI,
        periodKey: PERIOD_KEY,
      },
      {
        orderSn: "SN-N",
        orderCreatedAt: new Date("2026-09-02"),
        grossOmzet: 100000,
        netSettlement: 90000,
        hppSnapshot: 10000,
        qty: 1,
        status: OrderStatus.SELESAI,
        periodKey: PERIOD_KEY,
      },
    ]);
  });

  // Hanya SN-M yang sudah match ke Income Report (SN-N belum cair -> "Menunggu Cair").
  incomeEntryFindMany.mockResolvedValue([
    {
      type: "ORDER",
      orderSn: "SN-M",
      amount: 150000,
      releasedAt: new Date("2026-09-10"),
      import: { createdAt: new Date("2026-09-11") },
    },
  ]);
});

describe("GET /api/reports/recap — regresi bug Profit HPP pakai Estimasi", () => {
  it("Profit HPP per periode cut-off pakai nilai AKTUAL; order belum match di-exclude", async () => {
    const res = await GET(fakeReq("type=monthly&storeId=all"));
    const body = await res.json();
    const row = body.rows.find((r: any) => r.periodKey === PERIOD_KEY);

    expect(row).toBeDefined();
    expect(row.omzet).toBe(300000); // 200.000 + 100.000 -- agregasi omzet tidak berubah
    expect(row.profitHpp).toBe(150000 - 20000 * 2); // 110.000 = aktual SN-M - hppSnapshot*qty, SN-N tidak ikut
  });

  it("type=yearly juga pakai nilai AKTUAL (bukan Order.profitHpp estimasi)", async () => {
    const res = await GET(fakeReq("type=yearly&storeId=all"));
    const body = await res.json();
    const row = body.rows.find((r: any) => r.year === "2026");

    expect(row).toBeDefined();
    expect(row.profitHpp).toBe(150000 - 20000 * 2); // sama: hanya SN-M yang match
  });
});
