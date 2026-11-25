import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

// T-013 butir 16: kerugian retur rusak saat HPP tidak diketahui (hppSnapshot = 0).
const { orderFindMany } = vi.hoisted(() => ({ orderFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany: orderFindMany } } }));

import { returLoss, sumReturLoss } from "@/lib/returLoss";
import { returnsSummary, datasetReturns, datasetToPdfRows, formatCell } from "@/lib/reports";

const F = { storeIds: ["s1"], from: new Date("2026-07-25T17:00:00Z"), to: new Date("2026-08-25T16:59:59.999Z") };
const row = (orderSn: string, over: Record<string, unknown>) => ({
  orderSn,
  storeId: "s1",
  store: { code: "S1" },
  product: null,
  sku: "",
  productName: `Produk ${orderSn}`,
  qty: 2,
  hppSnapshot: 0,
  returCondition: null,
  status: OrderStatus.RETUR,
  orderCreatedAt: new Date("2026-08-01T05:00:00Z"),
  ...over,
});
const ROWS = [
  row("R1", { returCondition: "DAMAGED", hppSnapshot: 15000, qty: 2 }), // kerugian 30.000
  row("R2", { returCondition: "DAMAGED", hppSnapshot: 0, qty: 3 }), // HPP tidak diketahui
  row("R3", { returCondition: "DAMAGED", hppSnapshot: 0, qty: 1 }), // HPP tidak diketahui
  row("R4", { returCondition: "GOOD", hppSnapshot: 9000, qty: 1 }), // bukan rusak
  row("C1", { status: OrderStatus.CANCEL, hppSnapshot: 0, qty: 1 }),
];

beforeEach(() => {
  vi.clearAllMocks();
  orderFindMany.mockResolvedValue(ROWS);
});

describe("returLoss / sumReturLoss", () => {
  it("HPP diketahui -> hpp x qty; HPP 0 -> null (tidak diketahui); bukan retur rusak -> 0", () => {
    expect(returLoss({ status: "RETUR", returCondition: "DAMAGED", hppSnapshot: 15000, qty: 2 })).toBe(30000);
    expect(returLoss({ status: "RETUR", returCondition: "DAMAGED", hppSnapshot: 0, qty: 3 })).toBeNull();
    expect(returLoss({ status: "RETUR", returCondition: "GOOD", hppSnapshot: 9000, qty: 1 })).toBe(0);
    expect(returLoss({ status: "CANCEL", returCondition: "DAMAGED", hppSnapshot: 9000, qty: 1 })).toBe(0);
  });

  it("total hanya dari baris ber-HPP, baris tanpa HPP dihitung di tanpaHpp", () => {
    expect(sumReturLoss(ROWS as any)).toEqual({ kerugianHpp: 30000, tanpaHpp: { baris: 2 } });
  });
});

describe("returnsSummary (API /api/reports/returns)", () => {
  it("kerugianHpp tidak menjumlah HPP 0, tanpaHpp.baris terisi; unit rusak tetap semua baris", async () => {
    const s = await returnsSummary(F);
    expect(s.rusak.kerugianHpp).toBe(30000);
    expect(s.rusak.tanpaHpp).toEqual({ baris: 2 });
    expect(s.rusak.count).toBe(3);
    expect(s.rusak.unit).toBe(6);
  });

  it("semua retur rusak ber-HPP -> tanpaHpp.baris 0", async () => {
    orderFindMany.mockResolvedValue([row("R1", { returCondition: "DAMAGED", hppSnapshot: 15000, qty: 2 })]);
    const s = await returnsSummary(F);
    expect(s.rusak).toMatchObject({ kerugianHpp: 30000, tanpaHpp: { baris: 0 } });
  });
});

describe("datasetReturns (export Excel/PDF)", () => {
  it('sel kerugian: angka untuk HPP diketahui, "-" untuk HPP 0, 0 untuk bukan retur rusak', async () => {
    const ds = await datasetReturns(F);
    const k = Object.fromEntries(ds.rows.map((r) => [r.noPesanan, r.kerugianHpp]));
    expect(k).toEqual({ R1: 30000, R2: "-", R3: "-", R4: 0, C1: 0 });

    // PDF: "-" tetap "-", bukan "Rp 0"
    const col = ds.columns.findIndex((c) => c.key === "kerugianHpp");
    const pdf = datasetToPdfRows(ds);
    expect(pdf[1][col]).toBe("-");
    expect(pdf[0][col]).toBe("Rp 30.000");

    // ringkasan: total tanpa HPP 0 + catatan jumlah baris tanpa HPP
    expect(ds.summary).toContainEqual({ label: "Beban kerugian HPP (retur rusak)", value: "Rp 30.000" });
    expect(ds.summary).toContainEqual({ label: "Retur rusak tanpa HPP (kerugian tidak dihitung)", value: "2 baris" });
  });

  it("tanpa retur rusak tanpa HPP -> catatan tidak ada di ringkasan", async () => {
    orderFindMany.mockResolvedValue([row("R1", { returCondition: "DAMAGED", hppSnapshot: 15000, qty: 2 })]);
    const ds = await datasetReturns(F);
    expect((ds.summary ?? []).some((s) => s.label.includes("tanpa HPP"))).toBe(false);
  });

  it("formatCell: angka uang tetap diformat, teks penanda apa adanya", () => {
    expect(formatCell(1500, "money")).toBe("Rp 1.500");
    expect(formatCell("-", "money")).toBe("-");
  });
});
