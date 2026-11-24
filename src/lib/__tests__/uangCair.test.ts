import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 butir 9 — satu definisi "Uang Cair" (keputusan Founder):
// Uang Cair periode X = aktual Income Report pesanan yang DIBUAT di periode X, MATCH + SELISIH.
// Income non-pesanan (ADJUSTMENT, ORDER yang pesanannya tidak ada di DB) terpisah, hanya yang
// tanggal dananya (releasedAt; kosong -> tanggal import) masuk periode X.
// reconcile() asli yang jalan; hanya Prisma, sesi, dan filter query yang di-mock.
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

import { reconcile } from "@/lib/reconciliation";
import { getPeriodForMonth } from "@/lib/period";
import { GET as summaryGET } from "@/app/api/dashboard/summary/route";
import { GET as profitGET } from "@/app/api/reports/profit/route";
import { GET as reconGET } from "@/app/api/reconciliation/route";

const AUG = getPeriodForMonth("2026-08", 25); // 26 Jul - 25 Agu 2026 (WIB)
const STORE = ["store-1"];
const fakeReq = (path: string) => ({ url: `http://localhost${path}?storeId=all&period=2026-08` }) as unknown as NextRequest;
const isAllOrderSnsQuery = (args: any) =>
  !!args.select && Object.keys(args.select).length === 1 && args.select.orderSn === true;

type OrderRow = { orderSn: string; netSettlement: number; status: OrderStatus; day: string; hpp?: number };
function setOrders(rows: OrderRow[]) {
  const orders = rows.map((o) => ({
    orderSn: o.orderSn,
    productName: `Produk ${o.orderSn}`,
    sku: o.orderSn,
    productId: null,
    qty: 1,
    grossOmzet: o.netSettlement,
    netSettlement: o.netSettlement,
    hppSnapshot: o.hpp ?? 10000,
    profitAgen: 0,
    status: o.status,
    storeId: "store-1",
    store: { code: "S1", name: "Toko Satu" },
    orderCreatedAt: new Date(`${o.day}T05:00:00Z`),
    completedAt: null,
    settlementDate: null,
    deletedAt: null,
  }));
  orderFindMany.mockImplementation((args: any) => {
    if (isAllOrderSnsQuery(args)) return Promise.resolve(orders.map((o) => ({ orderSn: o.orderSn })));
    const st = args.where?.status;
    const range = args.where?.orderCreatedAt;
    return Promise.resolve(
      orders.filter((o) => {
        if (range && (o.orderCreatedAt < range.gte || o.orderCreatedAt > range.lte)) return false;
        if (!st) return true;
        if (typeof st === "string") return o.status === st;
        if (st.in) return st.in.includes(o.status);
        if (st.not) return o.status !== st.not;
        return true;
      })
    );
  });
}

type Entry = { type: "ORDER" | "ADJUSTMENT"; orderSn?: string; amount: number; releasedAt: string | null; importAt?: string };
function setIncome(entries: Entry[]) {
  incomeEntryFindMany.mockResolvedValue(
    entries.map((e) => ({
      type: e.type,
      orderSn: e.orderSn ?? null,
      amount: e.amount,
      adjustmentKind: e.type === "ADJUSTMENT" ? "Kompensasi" : null,
      description: null,
      raw: {},
      releasedAt: e.releasedAt ? new Date(e.releasedAt) : null,
      import: { createdAt: new Date(e.importAt ?? "2026-09-30T00:00:00Z") },
    }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] });
  resolveFilters.mockResolvedValue({ storeIds: STORE, from: AUG.from, to: AUG.to });
  orderAggregate.mockResolvedValue({ _sum: { grossOmzet: 0, netSettlement: 0 } });
});

describe("(1) satu periode: Cair Dashboard = Uang Cair Laporan Profit = aktualPesanan Rekonsiliasi", () => {
  it("MATCH + SELISIH masuk; income tanpa pesanan & adjustment TIDAK masuk ketiga angka itu", async () => {
    // Estimasi 100.000 per pesanan. Rasio payout baru dipakai kalau >= 15 sampel -> di sini rasio 1:
    // MATCH = aktual dekat 100.000 (tol 10%), SELISIH = aktual jauh dari itu.
    setOrders([
      { orderSn: "M1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-01" },
      { orderSn: "M2", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-02" },
      { orderSn: "S1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-03" },
      { orderSn: "B1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-04" }, // belum cair
    ]);
    setIncome([
      { type: "ORDER", orderSn: "M1", amount: 99000, releasedAt: "2026-08-10T03:00:00Z" },
      { type: "ORDER", orderSn: "M2", amount: 101000, releasedAt: "2026-08-11T03:00:00Z" },
      { type: "ORDER", orderSn: "S1", amount: 60000, releasedAt: "2026-08-12T03:00:00Z" }, // SELISIH
      { type: "ORDER", orderSn: "X-TIDAK-ADA", amount: 77777, releasedAt: "2026-08-13T03:00:00Z" },
      { type: "ADJUSTMENT", amount: 5000, releasedAt: "2026-08-14T03:00:00Z" },
    ]);

    const dash = await (await summaryGET(fakeReq("/api/dashboard/summary"))).json();
    const lap = await (await profitGET(fakeReq("/api/reports/profit"))).json();
    const rec = await (await reconGET(fakeReq("/api/reconciliation"))).json();

    const uangCair = 99000 + 101000 + 60000;
    expect(dash.cair).toBe(uangCair);
    expect(dash.cairCount).toBe(3);
    expect(lap.summary.totalUangCair).toBeCloseTo(uangCair, 6);
    expect(rec.totals.aktualPesanan).toBe(uangCair);
    // SELISIH sudah termasuk di Cair; field `selisih` kini JUMLAH pesanan, Rp-nya di selisihAktual
    expect(dash.selisih).toBe(1);
    expect(dash.selisihCount).toBe(1);
    expect(dash.selisihAktual).toBe(60000);
    // non-pesanan terpisah
    expect(rec.totals.incomeTanpaPesanan).toBe(77777);
    expect(rec.totals.adjustment).toBe(5000);
    expect(rec.totals.aktual).toBe(uangCair + 77777); // nama lama = pesanan + income tanpa pesanan
  });
});

describe("(2) income non-pesanan mengikuti periode, tanpa dobel/hilang", () => {
  // Periode berurutan (cut-off 25): Juli, Agustus, September 2026.
  const PERIODS = ["2026-07", "2026-08", "2026-09"].map((m) => getPeriodForMonth(m, 25));
  const NON_PESANAN: Entry[] = [
    { type: "ORDER", orderSn: "X1", amount: 1000, releasedAt: "2026-07-01T03:00:00Z" }, // Juli
    { type: "ORDER", orderSn: "X2", amount: 2000, releasedAt: "2026-07-25T16:59:59Z" }, // 25 Jul 23:59:59 WIB -> Juli
    { type: "ORDER", orderSn: "X3", amount: 4000, releasedAt: "2026-07-25T17:00:00Z" }, // 26 Jul 00:00 WIB -> Agustus
    { type: "ADJUSTMENT", amount: 8000, releasedAt: "2026-08-14T03:00:00Z" }, // Agustus
    { type: "ORDER", orderSn: "X4", amount: 16000, releasedAt: "2026-09-05T03:00:00Z" }, // September
    { type: "ADJUSTMENT", amount: 32000, releasedAt: "2026-09-25T16:00:00Z" }, // September
    { type: "ADJUSTMENT", amount: 64000, releasedAt: "2026-12-01T03:00:00Z" }, // DI LUAR ketiga periode
  ];

  beforeEach(() => {
    setOrders([]);
    setIncome(NON_PESANAN);
  });

  it("periode-periode itu berurutan tanpa celah (to + 1 ms = from berikutnya)", () => {
    for (let i = 1; i < PERIODS.length; i++) expect(PERIODS[i].from.getTime()).toBe(PERIODS[i - 1].to.getTime() + 1);
  });

  it("angka berubah sesuai periode", async () => {
    const r = await Promise.all(PERIODS.map((p) => reconcile({ storeIds: STORE, from: p.from, to: p.to })));
    expect(r.map((x) => x.totals.incomeTanpaPesanan)).toEqual([3000, 4000, 16000]);
    expect(r.map((x) => x.totals.adjustment)).toEqual([0, 8000, 32000]);
  });

  it("jumlah semua periode = total tanpa filter, dikurangi yang di luar semua periode (64.000)", async () => {
    const r = await Promise.all(PERIODS.map((p) => reconcile({ storeIds: STORE, from: p.from, to: p.to })));
    const sumPeriode = r.reduce((s, x) => s + x.totals.incomeTanpaPesanan + x.totals.adjustment, 0);
    const totalTanpaFilter = NON_PESANAN.reduce((s, e) => s + e.amount, 0);
    const diLuar = 64000;
    expect(sumPeriode).toBe(totalTanpaFilter - diLuar);
    // rentang selebar mungkin (dipakai Laporan Rekap) tetap menangkap semuanya yang sudah lewat
    const semua = await reconcile({ storeIds: STORE, from: new Date(0), to: new Date("2027-01-01") });
    expect(semua.totals.incomeTanpaPesanan + semua.totals.adjustment).toBe(totalTanpaFilter);
  });

  it("entri ORDER yang pesanannya ADA di DB tidak ikut filter tanggal dana (tetap per pesanan)", async () => {
    // Pesanan dibuat Agustus, dana dilepas Oktober -> tetap Uang Cair Agustus (logika lama).
    setOrders([{ orderSn: "P1", netSettlement: 50000, status: OrderStatus.SELESAI, day: "2026-08-10" }]);
    setIncome([{ type: "ORDER", orderSn: "P1", amount: 50000, releasedAt: "2026-10-05T03:00:00Z" }]);
    const aug = await reconcile({ storeIds: STORE, from: AUG.from, to: AUG.to });
    expect(aug.totals.aktualPesanan).toBe(50000);
    expect(aug.totals.incomeTanpaPesanan).toBe(0);
  });
});

describe("(3) releasedAt kosong -> tanggal import dipakai, dan dihitung", () => {
  it("entri tanpa releasedAt masuk periode tanggal importnya + nonPesananFallbackImport", async () => {
    setOrders([]);
    setIncome([
      { type: "ADJUSTMENT", amount: 700, releasedAt: null, importAt: "2026-08-20T03:00:00Z" }, // import Agustus
      { type: "ORDER", orderSn: "X9", amount: 900, releasedAt: null, importAt: "2026-08-21T03:00:00Z" }, // import Agustus
      { type: "ADJUSTMENT", amount: 300, releasedAt: null, importAt: "2026-09-10T03:00:00Z" }, // import September
      { type: "ADJUSTMENT", amount: 100, releasedAt: "2026-08-05T03:00:00Z", importAt: "2026-09-30T03:00:00Z" }, // releasedAt menang
    ]);
    const aug = await reconcile({ storeIds: STORE, from: AUG.from, to: AUG.to });
    expect(aug.totals.adjustment).toBe(700 + 100);
    expect(aug.totals.incomeTanpaPesanan).toBe(900);
    expect(aug.nonPesananFallbackImport).toBe(2);

    const sep = getPeriodForMonth("2026-09", 25);
    const s = await reconcile({ storeIds: STORE, from: sep.from, to: sep.to });
    expect(s.totals.adjustment).toBe(300);
    expect(s.nonPesananFallbackImport).toBe(1);
  });
});

describe("(9b) totals.selisih = aktualPesanan - estimasi pesanan yang sudah cair", () => {
  it("income tanpa pesanan dan pesanan yang belum cair tidak ikut", async () => {
    setOrders([
      { orderSn: "M1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-01" }, // MATCH 99.000
      { orderSn: "S1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-03" }, // SELISIH 60.000
      { orderSn: "B1", netSettlement: 100000, status: OrderStatus.SELESAI, day: "2026-08-04" }, // belum cair
    ]);
    setIncome([
      { type: "ORDER", orderSn: "M1", amount: 99000, releasedAt: "2026-08-10T03:00:00Z" },
      { type: "ORDER", orderSn: "S1", amount: 60000, releasedAt: "2026-08-12T03:00:00Z" },
      { type: "ORDER", orderSn: "X-TIDAK-ADA", amount: 77777, releasedAt: "2026-08-13T03:00:00Z" },
      { type: "ADJUSTMENT", amount: 5000, releasedAt: "2026-08-14T03:00:00Z" },
    ]);
    const r = await reconcile({ storeIds: STORE, from: AUG.from, to: AUG.to });
    expect(r.totals.aktualPesanan).toBe(159000);
    expect(r.totals.selisih).toBe(159000 - 200000); // BUKAN -41.000 + 77.777
    expect(r.totals.incomeTanpaPesanan).toBe(77777); // tetap ada, terpisah
  });
});
