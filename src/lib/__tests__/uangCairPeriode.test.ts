import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 batch 13 (tugas X): Uang Cair = semua saldo masuk Income Report per periode + rincian.
// Prisma di-mock dengan DB kecil di memori (data lokal tidak disentuh). reconcile() dan rumus asli jalan.
const { getSessionUser, resolveFilters, assertStoreAccess, db } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  resolveFilters: vi.fn(),
  assertStoreAccess: vi.fn(),
  db: { orders: [] as any[], entries: [] as any[] },
}));

function matchOrder(o: any, w: any = {}) {
  if (w.storeId?.in && !w.storeId.in.includes(o.storeId)) return false;
  if (typeof w.storeId === "string" && w.storeId !== o.storeId) return false;
  if (w.orderSn?.in && !w.orderSn.in.includes(o.orderSn)) return false;
  if (typeof w.orderSn === "string" && w.orderSn !== o.orderSn) return false;
  if (w.orderCreatedAt && (o.orderCreatedAt < w.orderCreatedAt.gte || o.orderCreatedAt > w.orderCreatedAt.lte)) return false;
  if (w.status?.in && !w.status.in.includes(o.status)) return false;
  if (w.status?.not && o.status === w.status.not) return false;
  if (typeof w.status === "string" && o.status !== w.status) return false;
  if (w.deletedAt === null && o.deletedAt) return false;
  return true;
}

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess, getAccessibleStoreIds: vi.fn() }));
vi.mock("@/lib/queryFilters", () => ({ resolveFilters }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: async () => ({ cutoffDay: 25 }) },
    order: {
      findMany: async ({ where }: any) => db.orders.filter((o) => matchOrder(o, where)),
      aggregate: async () => ({ _sum: { grossOmzet: 0, netSettlement: 0 } }),
    },
    incomeEntry: {
      // Hanya filter toko + status import (filter tanggal sengaja tidak ditiru: fungsi Uang Cair
      // menyaring ulang di memori, jadi test ini juga membuktikan saringan itu).
      findMany: async ({ where }: any) =>
        db.entries.filter(
          (e) =>
            (!where?.storeId?.in || where.storeId.in.includes(e.storeId)) &&
            (where?.import?.deletedAt !== null || !e.import.deletedAt) &&
            (where?.import?.isSuperseded !== false || !e.import.isSuperseded)
        ),
    },
  },
}));

import { getPeriodForMonth } from "@/lib/period";
import { summarizeUangCair, sumRincian, formatRincianUangCair, formatSaldoKeluar } from "@/lib/uangCairPeriode";
import { getUangCairPeriode } from "@/lib/uangCairPeriodeDb";
import { GET as summaryGET } from "@/app/api/dashboard/summary/route";
import { GET as profitGET } from "@/app/api/reports/profit/route";
import { GET as recapGET } from "@/app/api/reports/recap/route";
import { GET as reconGET } from "@/app/api/reconciliation/route";
import { buildReportDataset } from "@/lib/reports";

const SEP = getPeriodForMonth("2026-09", 25); // 26 Agu - 25 Sep 2026 (WIB)
const OKT = getPeriodForMonth("2026-10", 25); // 26 Sep - 25 Okt 2026 (WIB)
const D = (s: string) => new Date(s);
const imp = (createdAt = "2026-09-30T03:00:00Z", deletedAt: Date | null = null) => ({ createdAt: D(createdAt), deletedAt, isSuperseded: false });
const order = (storeId: string, orderSn: string, created: string, net: number) => ({
  id: `o-${orderSn}`, storeId, orderSn, sku: "SKU-1", productId: null, productName: "Produk", qty: 1,
  grossOmzet: net, netSettlement: net, adminFee: 0, hppSnapshot: 0, profitAgen: 0, status: OrderStatus.SELESAI,
  orderCreatedAt: D(created), completedAt: null, settlementDate: null, deletedAt: null,
  store: { code: storeId.toUpperCase(), name: storeId }, product: null,
});
const entry = (storeId: string, orderSn: string | null, amount: number, releasedAt: string | null, im = imp()) => ({
  storeId, type: orderSn ? "ORDER" : "ADJUSTMENT", orderSn, amount, releasedAt: releasedAt ? D(releasedAt) : null,
  adjustmentKind: orderSn ? null : "Penyesuaian", description: null, raw: {}, import: im,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
  resolveFilters.mockResolvedValue({ storeIds: ["s1"], from: SEP.from, to: SEP.to });
  assertStoreAccess.mockResolvedValue(["s1"]);
  db.orders = [
    order("s1", "SN-A", "2026-09-05T03:00:00Z", 100000), // dibuat periode Sep
    order("s1", "SN-OLD", "2026-08-10T03:00:00Z", 40000), // dibuat periode Agu
    order("s2", "SN-S2", "2026-09-06T03:00:00Z", 60000), // toko lain
  ];
  db.entries = [
    entry("s1", "SN-A", 90000, "2026-09-12T03:00:00Z"), // (a)
    entry("s1", "SN-A", -5000, "2026-09-12T03:00:00Z"), // keluar: tidak ikut total
    entry("s1", "SN-OLD", 40000, "2026-09-01T03:00:00Z"), // (b) pesanan periode lain
    entry("s1", "SN-X", 30000, "2026-09-20T03:00:00Z"), // (b) belum diunggah
    entry("s1", null, 2500, null, imp("2026-09-15T03:00:00Z")), // (c) fallback tanggal import
    entry("s1", null, 7000, "2026-09-25T16:30:00Z"), // (c) 25 Sep 23:30 WIB -> masih Sep
    entry("s1", null, 1111, "2026-09-25T17:10:00Z"), // 26 Sep 00:10 WIB -> Okt
    entry("s1", "SN-DEL", 99999, "2026-09-10T03:00:00Z", imp("2026-09-30T03:00:00Z", D("2026-10-01T00:00:00Z"))), // import soft-delete
    entry("s2", "SN-S2", 60000, "2026-09-10T03:00:00Z"), // toko lain
  ];
});

const req = (url = "http://x/api?period=2026-09") => ({ url }) as unknown as NextRequest;
const SEP_S1 = { total: 169500, pesananPeriodeIni: 90000, pesananLain: 70000, penyesuaian: 9500, saldoKeluar: 5000 };

describe("Uang Cair periode = semua saldo masuk", () => {
  it("total = (a)+(b)+(c); keluar tidak ikut; soft-delete diabaikan; fallback tanggal import", async () => {
    const r = await getUangCairPeriode({ storeIds: ["s1"], from: SEP.from, to: SEP.to });
    expect(r).toMatchObject(SEP_S1);
    expect(r.total).toBe(r.pesananPeriodeIni + r.pesananLain + r.penyesuaian);
    expect(r.fallbackImport).toBe(1);
    expect(formatSaldoKeluar(r)).toBe("Saldo keluar: Rp 5.000");
    expect(formatSaldoKeluar({ saldoKeluar: 0 })).toBeNull();
    expect(formatRincianUangCair(r)).toContain("Rp 90.000");
  });

  it("batas cut-off WIB: 25 Sep 23:30 WIB masuk Sep, 26 Sep 00:10 WIB masuk Okt", async () => {
    const okt = await getUangCairPeriode({ storeIds: ["s1"], from: OKT.from, to: OKT.to });
    expect(okt.total).toBe(1111);
    expect(okt.penyesuaian).toBe(1111);
  });

  it("filter toko (Admin Toko hanya entri tokonya); gabungan toko menjumlah", async () => {
    const s2 = await getUangCairPeriode({ storeIds: ["s2"], from: SEP.from, to: SEP.to });
    expect(s2).toMatchObject({ total: 60000, pesananPeriodeIni: 60000, pesananLain: 0, penyesuaian: 0 });
    const both = await getUangCairPeriode({ storeIds: ["s1", "s2"], from: SEP.from, to: SEP.to });
    expect(both.total).toBe(SEP_S1.total + 60000);
    expect(both.byStore.s1.total).toBe(SEP_S1.total);
    expect(both.byStore.s2.total).toBe(60000);
    expect(await getUangCairPeriode({ storeIds: [], from: SEP.from, to: SEP.to })).toMatchObject({ total: 0 });
  });

  it("fungsi murni: entri tanpa releasedAt pakai tanggal import; sumRincian tetap = (a)+(b)+(c)", () => {
    const e = { storeId: "s1", type: "ADJUSTMENT", orderSn: null, amount: 100, releasedAt: null, importCreatedAt: D("2026-10-01T03:00:00Z") };
    expect(summarizeUangCair([e], SEP.from, SEP.to, new Map()).all.total).toBe(0);
    expect(summarizeUangCair([e], OKT.from, OKT.to, new Map()).all.total).toBe(100);
    const s = sumRincian([
      { ...SEP_S1, jumlahEntri: 1, fallbackImport: 0 },
      { ...SEP_S1, jumlahEntri: 1, fallbackImport: 0 },
    ]);
    expect(s.total).toBe(2 * SEP_S1.total);
  });

  it("angka Dashboard = Laporan Profit = Rekap = Rekonsiliasi = export untuk fixture yang sama", async () => {
    const dash = await (await summaryGET(req())).json();
    const profit = await (await profitGET(req())).json();
    const recap = await (await recapGET(req("http://x/api/reports/recap?type=monthly&storeId=s1"))).json();
    const recon = await (await reconGET(req())).json();
    expect(dash.uangCairPeriode).toEqual(SEP_S1);
    expect(profit.summary.uangCairPeriode).toEqual(SEP_S1);
    expect(recon.uangCairPeriode).toEqual(SEP_S1);
    const sepRow = recap.rows.find((r: any) => r.month === "2026-09");
    expect(sepRow.uangCairTotal).toBe(SEP_S1.total);
    expect(sepRow.uangCairRincian).toEqual(SEP_S1);
    const yearly = await (await recapGET(req("http://x/api/reports/recap?type=yearly&storeId=s1"))).json();
    expect(yearly.rows.find((r: any) => r.year === "2026").uangCairTotal).toBe(SEP_S1.total + 1111);

    // Kolom per SKU & Profit HPP tetap berbasis pesanan periode ini (reconcile): SN-A 90.000 - 5.000.
    expect(profit.summary.totalUangCair).toBe(85000);

    const f = { storeIds: ["s1"], from: SEP.from, to: SEP.to };
    const ds = await buildReportDataset("profit" as any, f, {} as any);
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect(sum["Uang Cair (semua saldo masuk periode ini)"]).toBe("Rp 169.500");
    expect(sum["Uang Cair Pesanan Periode Ini"]).toBe("Rp 85.000");
    const rekap = await buildReportDataset("recap" as any, f, { type: "monthly" } as any);
    expect(rekap.rows.find((r) => String(r.periode).startsWith("September 2026"))?.uangCair).toBe(SEP_S1.total);
  });
});
