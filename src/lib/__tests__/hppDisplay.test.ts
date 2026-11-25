import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { OrderStatus } from "@prisma/client";

// T-013 temuan QA 2 (batch 10): baris yang HPP-nya seluruhnya tidak diketahui tampil "-", bukan
// 0 / "Rp 0". Baris ber-HPP & campuran tetap angka. Rumus/total/API tidak berubah.
const { orderFindMany, incomeEntryFindMany } = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  incomeEntryFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: orderFindMany }, incomeEntry: { findMany: incomeEntryFindMany } },
}));

import {
  isProfitHppUnknown,
  hasKnownHpp,
  shownProfitHpp,
  shownProfitAgen,
  shownSelisih,
  formatRupiahOrDash,
} from "@/lib/hppDisplay";
import { leaderboardLists } from "@/components/LeaderboardToko";
import { datasetProfit, formatCell } from "@/lib/reports";
import { buildXlsx } from "@/lib/export";

const NONE = { baris: 0, uangCair: 0 };

describe("hppDisplay — aturan tampilan", () => {
  it('tanpa HPP seluruhnya -> "-"', () => {
    const r = { profitHpp: 0, uangCair: 50000, tanpaHpp: { baris: 2, uangCair: 50000 }, profitAgen: 0, selisih: 0 };
    expect(isProfitHppUnknown(r)).toBe(true);
    expect(shownProfitHpp(r)).toBe("-");
    expect(shownProfitAgen(r)).toBe("-");
    expect(shownSelisih(r)).toBe("-");
    expect(formatRupiahOrDash(shownProfitHpp(r))).toBe("-");
  });

  it("dengan HPP -> angka (termasuk profit negatif dan profit 0 yang benar-benar dihitung)", () => {
    expect(shownProfitHpp({ profitHpp: 42000, uangCair: 66000, tanpaHpp: NONE })).toBe(42000);
    expect(shownProfitHpp({ profitHpp: -5000, uangCair: 10000, tanpaHpp: NONE })).toBe(-5000);
    expect(shownProfitHpp({ profitHpp: 0, uangCair: 24000, tanpaHpp: NONE })).toBe(0);
    expect(formatRupiahOrDash(42000)).toBe("Rp 42.000");
  });

  it("campuran (sebagian HPP diketahui) -> angka, tanpaHpp tetap tercatat", () => {
    const r = { profitHpp: 42000, uangCair: 116000, tanpaHpp: { baris: 1, uangCair: 50000 }, profitAgen: 13500, selisih: -28500 };
    expect(isProfitHppUnknown(r)).toBe(false);
    expect(shownProfitHpp(r)).toBe(42000);
    expect(shownProfitAgen(r)).toBe(13500);
    expect(shownSelisih(r)).toBe(-28500);
    expect(r.tanpaHpp).toEqual({ baris: 1, uangCair: 50000 });
  });

  it("campuran dengan profit ber-HPP tepat 0 tetap angka (uang cair ber-HPP > 0)", () => {
    expect(shownProfitHpp({ profitHpp: 0, uangCair: 74000, tanpaHpp: { baris: 1, uangCair: 50000 } })).toBe(0);
  });

  it("Profit Agen yang tetap terhitung (bukan 0) tidak diganti '-' walau Profit HPP tidak diketahui", () => {
    const r = { profitHpp: 0, uangCair: 50000, tanpaHpp: { baris: 1, uangCair: 50000 }, profitAgen: 9000 };
    expect(shownProfitHpp(r)).toBe("-");
    expect(shownProfitAgen(r)).toBe(9000);
  });

  it("belum cair / tanpa transaksi bukan urusan HPP -> angka apa adanya", () => {
    const r = { profitHpp: 0, uangCair: 0, tanpaHpp: NONE };
    expect(shownProfitHpp(r)).toBe(0);
    expect(hasKnownHpp(r)).toBe(false);
  });
});

describe("Performa Toko — Toko Paling Untung tidak memilih toko tanpa HPP", () => {
  const ber = { toko: "B01 - Ber HPP", order: 5, omzet: 100000, profitHpp: 20000, uangCair: 80000, tanpaHpp: NONE };
  const rugi = { toko: "R01 - Rugi", order: 2, omzet: 50000, profitHpp: -3000, uangCair: 30000, tanpaHpp: NONE };
  const tanpa = { toko: "T01 - Tanpa HPP", order: 9, omzet: 900000, profitHpp: 0, uangCair: 500000, tanpaHpp: { baris: 9, uangCair: 500000 } };
  const kosong = { toko: "K01 - Kosong", order: 0, omzet: 0, profitHpp: 0, uangCair: 0, tanpaHpp: NONE };

  it("toko tanpa HPP tidak masuk daftar untung maupun perlu perhatian", () => {
    const l = leaderboardLists([tanpa, ber, rugi, kosong]);
    expect(l.untung.map((r) => r.toko)).toEqual(["B01 - Ber HPP", "R01 - Rugi"]);
    expect(l.rugi.map((r) => r.toko)).toEqual(["R01 - Rugi", "B01 - Ber HPP"]);
    expect(l.belumAdaHpp).toBe(false);
  });

  it('semua toko bertransaksi tanpa HPP -> daftar kosong + "Belum ada data HPP"', () => {
    const l = leaderboardLists([tanpa, kosong]);
    expect(l.untung).toEqual([]);
    expect(l.rugi).toEqual([]);
    expect(l.belumAdaHpp).toBe(true);
  });

  it("tidak ada toko bertransaksi -> bukan kasus HPP", () => {
    expect(leaderboardLists([kosong]).belumAdaHpp).toBe(false);
  });
});

// ---- Export Laporan Profit (datasetProfit asli + reconcile asli; hanya Prisma di-mock)
//  Produk A: HPP diketahui, cair 66.000 -> profit 42.000
//  Produk B: HPP tidak diketahui, cair 50.000 -> "-"
//  Produk M: campuran -- 1 baris ber-HPP (cair 30.000, HPP 10.000) + 1 baris tanpa HPP (cair 20.000)
const ORDERS = [
  { orderSn: "SN-A", sku: "A", productId: "p-a", productName: "Produk A", qty: 3, grossOmzet: 75000, netSettlement: 66000, hppSnapshot: 8000, profitAgen: 13500 },
  { orderSn: "SN-B", sku: "", productId: null, productName: "Produk B", qty: 2, grossOmzet: 60000, netSettlement: 50000, hppSnapshot: 0, profitAgen: 0 },
  { orderSn: "SN-M1", sku: "M", productId: "p-m", productName: "Produk M", qty: 1, grossOmzet: 35000, netSettlement: 30000, hppSnapshot: 10000, profitAgen: 7000 },
  { orderSn: "SN-M2", sku: "M", productId: "p-m", productName: "Produk M", qty: 1, grossOmzet: 25000, netSettlement: 20000, hppSnapshot: 0, profitAgen: 0 },
].map((o) => ({ ...o, status: OrderStatus.SELESAI, product: o.productId ? { sku: o.sku } : null }));
const FILTER = { storeIds: ["store-1"], from: new Date("2026-08-26"), to: new Date("2026-09-25T23:59:59.999Z") };

function mockOrders(list: typeof ORDERS) {
  orderFindMany.mockImplementation((args: any) => {
    if (args.include?.store) {
      return Promise.resolve(
        list.map((o) => ({
          orderSn: o.orderSn,
          store: { code: "S1" },
          productName: o.productName,
          qty: o.qty,
          status: o.status,
          netSettlement: o.netSettlement,
          orderCreatedAt: new Date("2026-09-01"),
          completedAt: null,
          settlementDate: null,
        }))
      );
    }
    if (args.select && Object.keys(args.select).length === 1) return Promise.resolve(list.map((o) => ({ orderSn: o.orderSn })));
    return Promise.resolve(list);
  });
  incomeEntryFindMany.mockResolvedValue(
    list.map((o) => ({ orderSn: o.orderSn, amount: o.netSettlement, type: "ORDER", releasedAt: new Date("2026-09-10"), import: { createdAt: new Date("2026-09-11") } }))
  );
}

describe("export Laporan Profit — sel tanpa HPP '-' (Excel teks, angka tetap number; PDF '-')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrders(ORDERS);
  });

  it("baris tanpa HPP '-', baris ber-HPP angka, baris campuran angka + tanpaHpp", async () => {
    const ds = await datasetProfit(FILTER);
    const by = Object.fromEntries(ds.rows.map((r) => [r.produk, r]));
    expect([by["Produk B"].profitHpp, by["Produk B"].profitAgen, by["Produk B"].selisih]).toEqual(["-", "-", "-"]);
    expect(by["Produk B"].uangCair).toBe(50000); // Uang Cair tetap angka
    expect([by["Produk A"].profitHpp, by["Produk A"].profitAgen, by["Produk A"].selisih]).toEqual([42000, 13500, 13500 - 42000]);
    expect(by["Produk M"].profitHpp).toBe(30000 - 10000);
    expect(by["Produk M"].tanpaHpp).toEqual({ baris: 1, uangCair: 20000 });
    // total tidak berubah (dihitung dari angka asli, bukan dari sel tampilan)
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect(sum["Total Profit HPP (Nett)"]).toBe("Rp 62.000");
    expect(sum["Tanpa HPP (tidak dihitung ke profit)"]).toBe("2 baris, Rp 70.000");
  });

  it("PDF: sel '-' tampil '-' (bukan 'Rp 0'); Excel: '-' teks, angka tetap number", async () => {
    const ds = await datasetProfit(FILTER);
    const b = ds.rows.find((r) => r.produk === "Produk B")!;
    expect(formatCell(b.profitHpp, "money")).toBe("-");
    const xlsx = await buildXlsx(ds.title, ds.columns.map((c) => ({ header: c.header, key: c.key, kind: c.kind })), ds.rows);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as any); // pola sama dengan exportXlsx.test.ts (tipe Buffer exceljs)
    const ws = wb.worksheets[0];
    const header = (ws.getRow(1).values as any[]).slice(1);
    const col = (h: string) => header.indexOf(h) + 1;
    const rowOf = (name: string) => {
      let found: ExcelJS.Row | undefined;
      ws.eachRow((row) => {
        if (row.getCell(col("Produk")).value === name) found = row;
      });
      return found!;
    };
    expect(rowOf("Produk B").getCell(col("Profit HPP (Nett)")).value).toBe("-");
    expect(rowOf("Produk B").getCell(col("Uang Cair")).value).toBe(50000);
    expect(typeof rowOf("Produk A").getCell(col("Profit HPP (Nett)")).value).toBe("number");
  });

  it("semua produk tanpa HPP -> total Profit HPP/Agen/Selisih di ringkasan juga '-'", async () => {
    mockOrders(ORDERS.filter((o) => o.hppSnapshot === 0));
    const ds = await datasetProfit(FILTER);
    const sum = Object.fromEntries(ds.summary!.map((s) => [s.label, s.value]));
    expect([sum["Total Profit HPP (Nett)"], sum["Total Profit Agen"], sum["Selisih Agen vs Riil"]]).toEqual(["-", "-", "-"]);
    expect(sum["Total Uang Cair"]).toBe("Rp 70.000");
  });
});

// ---- T-013 batch 11 (tugas V): kartu Profit HPP Dashboard & warna header Excel
import { shownDashboardProfitHpp } from "@/lib/hppDisplay";
import { XLSX_HEADER_FILL_ARGB } from "@/lib/export";

describe("Dashboard — kartu Profit HPP", () => {
  it('seluruh uang cair dari baris tanpa HPP -> "-" (bukan "Rp 0")', () => {
    const s = { profitHpp: 0, cair: 56022026, tanpaHpp: { baris: 755, uangCair: 56022026 } };
    expect(formatRupiahOrDash(shownDashboardProfitHpp(s))).toBe("-");
  });

  it("dengan HPP -> angka (termasuk campuran dan profit negatif)", () => {
    expect(formatRupiahOrDash(shownDashboardProfitHpp({ profitHpp: 42000, cair: 66000, tanpaHpp: { baris: 0, uangCair: 0 } }))).toBe("Rp 42.000");
    expect(shownDashboardProfitHpp({ profitHpp: 20000, cair: 116000, tanpaHpp: { baris: 1, uangCair: 50000 } })).toBe(20000);
    expect(shownDashboardProfitHpp({ profitHpp: -3000, cair: 30000, tanpaHpp: null })).toBe(-3000);
  });

  it('tanpa ringkasan (gagal muat / akun tanpa toko) -> "-"', () => {
    expect(shownDashboardProfitHpp(undefined)).toBe("-");
  });
});

describe("Excel — header bukan pink", () => {
  it("header memakai abu terang brand, bukan EC4899", async () => {
    const xlsx = await buildXlsx("Uji", [{ header: "Kolom", key: "k" }], [{ k: 1 }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as any);
    const fill = wb.worksheets[0].getRow(1).getCell(1).fill as any;
    expect(fill.fgColor.argb).toBe(XLSX_HEADER_FILL_ARGB);
    expect(fill.fgColor.argb.toUpperCase()).not.toContain("EC4899");
  });
});
