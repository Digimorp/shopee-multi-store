import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 butir 10: Rekap Bulanan/Tahunan per periode cut-off dari tanggal pesanan dibuat (WIB).
// Dijalankan di TZ=Asia/Jakarta dan TZ=UTC — hasil harus sama.
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

import { getPeriodMonthForDate, getPeriodForMonth, prevPeriodMonth } from "@/lib/period";
import { buildRecap, type RecapOrder } from "@/lib/recap";
import { datasetRecap } from "@/lib/reports";
import { GET } from "@/app/api/reports/recap/route";

const NO_ACTUAL = { estimasiByOrderSn: new Map<string, number>(), aktualByOrderSn: new Map<string, number>() };
let n = 0;
const order = (iso: string, over: Partial<RecapOrder> = {}): RecapOrder => ({
  orderSn: `SN-${++n}`,
  orderCreatedAt: new Date(iso),
  grossOmzet: 100000,
  netSettlement: 90000,
  hppSnapshot: 40000,
  qty: 1,
  status: OrderStatus.SELESAI,
  ...over,
});

describe("getPeriodMonthForDate (WIB, cut-off)", () => {
  it("tgl 25 dan 26 dengan cut-off 25 masuk bulan berbeda (batas jam WIB)", () => {
    expect(getPeriodMonthForDate(new Date("2026-08-25T16:59:59.999Z"), 25)).toBe("2026-08"); // 25 Agu 23:59:59 WIB
    expect(getPeriodMonthForDate(new Date("2026-08-25T17:00:00.000Z"), 25)).toBe("2026-09"); // 26 Agu 00:00 WIB
  });

  it("selalu berada di dalam getPeriodForMonth(hasil) — konsisten dengan resolveFilters", () => {
    for (const cutoff of [25, 28, 31]) {
      for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 2, 1); t += 5 * 3_600_000) {
        const d = new Date(t);
        const p = getPeriodForMonth(getPeriodMonthForDate(d, cutoff), cutoff);
        expect(d >= p.from && d <= p.to).toBe(true);
      }
    }
  });

  it("prevPeriodMonth melewati pergantian tahun", () => {
    expect(prevPeriodMonth("2027-01")).toBe("2026-12");
    expect(prevPeriodMonth("2026-09")).toBe("2026-08");
  });
});

describe("buildRecap", () => {
  it("bulanan: pesanan 25 dan 26 (cut-off 25) masuk bulan berbeda, bukan dari periodKey tersimpan", () => {
    const { months } = buildRecap(
      [order("2026-08-25T16:59:00Z"), order("2026-08-25T17:00:00Z", { grossOmzet: 50000 })],
      NO_ACTUAL,
      25
    );
    expect(months.map((m) => [m.month, m.omzet])).toEqual([
      ["2026-09", 50000],
      ["2026-08", 100000],
    ]);
    expect(months[1].periodKey).toBe("2026-07-26_2026-08-25");
    expect(months[1].label).toBe("26 Jul - 25 Agu 2026");
  });

  it("tahunan: 31 Des 23:30 WIB (= 16:30 UTC) masuk tahun yang benar, apa pun TZ server", () => {
    // tahun = tahun periode. Cut-off 25: 31 Des 2026 23:30 WIB ada di periode Januari 2027.
    expect(buildRecap([order("2026-12-31T16:30:00Z")], NO_ACTUAL, 25).years.map((y) => y.year)).toEqual(["2027"]);
    // Cut-off 31 (akhir bulan): 31 Des 23:30 WIB -> 2026; 1 Jan 00:30 WIB (= 31 Des 17:30 UTC) -> 2027.
    expect(buildRecap([order("2026-12-31T16:30:00Z")], NO_ACTUAL, 31).years.map((y) => y.year)).toEqual(["2026"]);
    expect(buildRecap([order("2026-12-31T17:30:00Z")], NO_ACTUAL, 31).years.map((y) => y.year)).toEqual(["2027"]);
  });

  it('selisih: bulan sebelumnya ada -> persentase benar; tidak ada data -> null ("-"), bukan dibanding periode lain', () => {
    const { months } = buildRecap(
      [
        order("2026-06-10T03:00:00Z", { grossOmzet: 100000 }), // Juni
        order("2026-07-10T03:00:00Z", { grossOmzet: 150000 }), // Juli
        order("2026-09-10T03:00:00Z", { grossOmzet: 300000 }), // September (Agustus kosong)
      ],
      NO_ACTUAL,
      25
    );
    const by = Object.fromEntries(months.map((m) => [m.month, m]));
    expect(by["2026-07"].deltaOmzet).toBe(50000);
    expect(by["2026-07"].deltaPct).toBeCloseTo(50);
    expect(by["2026-09"].deltaOmzet).toBeNull(); // dulu: dibanding Juli
    expect(by["2026-09"].deltaPct).toBeNull();
    expect(by["2026-06"].deltaOmzet).toBeNull(); // bulan tertua: dulu 0%
  });

  it("jumlah 12 bulan = tahunan (omzet, Uang Cair, Profit HPP, tanpa HPP)", () => {
    const orders: RecapOrder[] = [];
    const aktual = new Map<string, number>();
    const estimasi = new Map<string, number>();
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      // awal & akhir periode tiap bulan (batas cut-off), satu tanpa HPP, satu belum cair
      const p = getPeriodForMonth(`2026-${mm}`, 25);
      const a = order(p.from.toISOString(), { grossOmzet: 1000 * m });
      const b = order(p.to.toISOString(), { grossOmzet: 500, hppSnapshot: 0 });
      const c = order(p.to.toISOString(), { grossOmzet: 300 }); // belum cair
      for (const o of [a, b]) {
        aktual.set(o.orderSn, 80000 + m);
        estimasi.set(o.orderSn, o.netSettlement);
      }
      orders.push(a, b, c);
    }
    orders.push(order("2027-01-05T03:00:00Z")); // tahun lain, tidak ikut 2026
    const { months, years } = buildRecap(orders, { aktualByOrderSn: aktual, estimasiByOrderSn: estimasi }, 25);
    const m2026 = months.filter((m) => m.month.startsWith("2026-"));
    expect(m2026).toHaveLength(12);
    const y2026 = years.find((y) => y.year === "2026")!;
    const sum = (k: "omzet" | "uangCair" | "profitHpp") => m2026.reduce((s, m) => s + m[k], 0);
    expect(y2026.omzet).toBe(sum("omzet"));
    expect(y2026.uangCair).toBe(sum("uangCair"));
    expect(y2026.profitHpp).toBe(sum("profitHpp"));
    expect(y2026.tanpaHpp.baris).toBe(m2026.reduce((s, m) => s + m.tanpaHpp.baris, 0));
    expect(y2026.uangCair).toBeGreaterThan(0);
  });

  it("CANCEL tidak dihitung; Uang Cair hanya pesanan SELESAI yang sudah cair (rumus lama)", () => {
    const a = order("2026-08-10T03:00:00Z");
    const { months } = buildRecap(
      [a, order("2026-08-11T03:00:00Z", { status: OrderStatus.CANCEL }), order("2026-08-12T03:00:00Z", { status: OrderStatus.TRANSIT })],
      { aktualByOrderSn: new Map([[a.orderSn, 85000]]), estimasiByOrderSn: new Map([[a.orderSn, 90000]]) },
      25
    );
    expect(months[0]).toMatchObject({ omzet: 200000, uangCair: 85000, profitHpp: 85000 - 40000 });
  });
});

describe("export datasetRecap = API /api/reports/recap (angka sama)", () => {
  const ORDERS = [
    { orderSn: "A", orderCreatedAt: new Date("2026-07-10T03:00:00Z"), grossOmzet: 100000, netSettlement: 90000, hppSnapshot: 40000, qty: 1, status: OrderStatus.SELESAI },
    { orderSn: "B", orderCreatedAt: new Date("2026-09-10T03:00:00Z"), grossOmzet: 300000, netSettlement: 90000, hppSnapshot: 40000, qty: 1, status: OrderStatus.SELESAI },
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
    assertStoreAccess.mockResolvedValue(["s1"]);
    periodSettingFindFirst.mockResolvedValue({ cutoffDay: 25 });
    // query reconcile() (include store / select orderSn) -> kosong; query rekap -> ORDERS
    orderFindMany.mockImplementation((args: any) =>
      Promise.resolve(args.include?.store || (args.select && Object.keys(args.select).length === 1) ? [] : ORDERS)
    );
    incomeEntryFindMany.mockResolvedValue([]);
  });

  it('bulanan: omzet & selisih sama; bulan tanpa data sebelumnya -> "-" di export', async () => {
    const api = (await (await GET({ url: "http://localhost/api/reports/recap?type=monthly&storeId=all" } as NextRequest)).json()).rows;
    const ds = await datasetRecap({ storeIds: ["s1"], from: new Date(0), to: new Date() }, "monthly");
    expect(ds.rows.map((r) => r.omzet)).toEqual(api.map((r: any) => r.omzet));
    expect(ds.rows.map((r) => r.periode)).toEqual(api.map((r: any) => r.label));
    expect(api.map((r: any) => r.deltaOmzet)).toEqual([null, null]); // Sep (Agu kosong), Jul (tertua)
    expect(ds.rows.map((r) => [r.selisih, r.selisihPct])).toEqual([
      ["-", "-"],
      ["-", "-"],
    ]);
  });

  it("tahunan: sama", async () => {
    const api = (await (await GET({ url: "http://localhost/api/reports/recap?type=yearly&storeId=all" } as NextRequest)).json()).rows;
    const ds = await datasetRecap({ storeIds: ["s1"], from: new Date(0), to: new Date() }, "yearly");
    expect(ds.rows.map((r) => [r.tahun, r.omzet, r.uangCair, r.profitHpp])).toEqual(
      api.map((r: any) => [r.year, r.omzet, r.uangCair, r.profitHpp])
    );
  });
});
