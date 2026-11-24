import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// T-013 nomor 7: period salah format -> HTTP 400 "Format period harus YYYY-MM", bukan 500.
// resolveFilters() dan withPeriodError() ASLI yang jalan; cuma sesi & Prisma yang di-mock.
// Prisma: setiap model.method mengembalikan [] / agregat kosong -> period valid tetap 200.
const { getSessionUser, assertStoreAccess } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
}));
vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/prisma", () => {
  const empty = (method: string) => {
    if (method === "findFirst" || method === "findUnique") return Promise.resolve(null);
    if (method === "count") return Promise.resolve(0);
    if (method === "aggregate") return Promise.resolve({ _sum: {}, _count: {}, _avg: {}, _min: {}, _max: {} });
    return Promise.resolve([]);
  };
  const model = () => new Proxy({}, { get: (_t, method: string) => vi.fn(() => empty(method)) });
  return { prisma: new Proxy({}, { get: (_t, name: string) => (name === "$transaction" ? (x: any) => Promise.all(x) : model()) }) };
});

import { GET as alerts } from "@/app/api/alerts/route";
import { GET as dashSummary } from "@/app/api/dashboard/summary/route";
import { GET as dashTopProducts } from "@/app/api/dashboard/top-products/route";
import { GET as dashTrend } from "@/app/api/dashboard/trend/route";
import { GET as orders } from "@/app/api/orders/route";
import { GET as reconciliation } from "@/app/api/reconciliation/route";
import { GET as cashflow } from "@/app/api/reports/cashflow/route";
import { GET as exportReport } from "@/app/api/reports/export/route";
import { GET as profit } from "@/app/api/reports/profit/route";
import { GET as returns } from "@/app/api/reports/returns/route";
import { GET as storePerformance } from "@/app/api/reports/store-performance/route";

const ROUTES: [string, (req: NextRequest) => Promise<Response>][] = [
  ["alerts", alerts],
  ["dashboard/summary", dashSummary],
  ["dashboard/top-products", dashTopProducts],
  ["dashboard/trend", dashTrend],
  ["orders", orders],
  ["reconciliation", reconciliation],
  ["reports/cashflow", cashflow],
  ["reports/export", exportReport],
  ["reports/profit", profit],
  ["reports/returns", returns],
  ["reports/store-performance", storePerformance],
];

const req = (path: string, qs: string) => ({ url: `http://localhost/api/${path}?storeId=all&${qs}` }) as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
});

describe("period tidak valid -> 400 di semua route yang memakai resolveFilters", () => {
  for (const [name, GET] of ROUTES) {
    it.each(["abc", "2026-13", "2026-00"])(`${name}: period=%s -> 400 dengan pesan jelas`, async (bad) => {
      const res = await GET(req(name, `period=${bad}&report=profit&format=xlsx`));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/^Format period harus YYYY-MM/);
      expect(body.error).toContain(`"${bad}"`);
    });
  }
});

describe("period valid tetap seperti semula", () => {
  it("reports/profit: period=2026-08 -> 200", async () => {
    const res = await profit(req("reports/profit", "period=2026-08"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalProfitHpp).toBe(0);
    expect(body.rows).toEqual([]);
  });

  it("dashboard/summary & reports/store-performance: period=2026-08 -> 200", async () => {
    expect((await dashSummary(req("dashboard/summary", "period=2026-08"))).status).toBe(200);
    expect((await storePerformance(req("reports/store-performance", "period=2026-08"))).status).toBe(200);
  });

  it("error lain tetap dilempar (tidak diubah jadi 400)", async () => {
    getSessionUser.mockRejectedValueOnce(new Error("db mati"));
    await expect(profit(req("reports/profit", "period=2026-08"))).rejects.toThrow("db mati");
  });
});
