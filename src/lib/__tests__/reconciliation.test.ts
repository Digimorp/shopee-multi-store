import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  deriveStage,
  MATCH_TOLERANCE,
  FINAL_LOCK_DAYS,
  buildActualLookup,
  allocateActual,
  type ReconResult,
  type ReconItem,
} from "@/lib/reconciliation";

const now = new Date("2026-09-08T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

function order(over: Partial<Parameters<typeof deriveStage>[0]> = {}) {
  return {
    status: OrderStatus.SELESAI,
    orderCreatedAt: daysAgo(20),
    completedAt: null,
    settlementDate: null,
    ...over,
  } as Parameters<typeof deriveStage>[0];
}

describe("MATCH_TOLERANCE", () => {
  it("Rp 5 (pembulatan)", () => expect(MATCH_TOLERANCE).toBe(5));
});

describe("deriveStage", () => {
  it("TRANSIT tanpa income -> SAMPAI", () => {
    expect(deriveStage(order({ status: OrderStatus.TRANSIT }), null, now)).toBe("SAMPAI");
  });

  it("PENDING/SELESAI tanpa income -> MENUNGGU_CAIR", () => {
    expect(deriveStage(order({ status: OrderStatus.PENDING_SETTLEMENT }), null, now)).toBe("MENUNGGU_CAIR");
    expect(deriveStage(order({ status: OrderStatus.SELESAI }), null, now)).toBe("MENUNGGU_CAIR");
  });

  it("ada income, < H+14 dari settlementDate -> CAIR", () => {
    expect(deriveStage(order({ settlementDate: daysAgo(3) }), { releasedAt: daysAgo(3) }, now)).toBe("CAIR");
  });

  it("ada income, >= H+14 dari settlementDate -> CAIR_FINAL", () => {
    expect(deriveStage(order({ settlementDate: daysAgo(FINAL_LOCK_DAYS + 1) }), { releasedAt: daysAgo(15) }, now)).toBe(
      "CAIR_FINAL"
    );
  });

  it("fallback ref: pakai completedAt kalau settlementDate null", () => {
    expect(deriveStage(order({ completedAt: daysAgo(20) }), { releasedAt: null }, now)).toBe("CAIR_FINAL");
  });

  it("fallback ref: pakai releasedAt income kalau order tak punya tgl", () => {
    expect(deriveStage(order({ orderCreatedAt: daysAgo(2) }), { releasedAt: daysAgo(2) }, now)).toBe("CAIR");
  });
});

function reconItem(over: Partial<ReconItem> = {}): ReconItem {
  return {
    orderSn: "SN1",
    storeCode: "T01",
    productName: "Produk",
    qty: 1,
    status: OrderStatus.SELESAI,
    estimasi: 100000,
    aktual: null,
    selisih: null,
    category: "BELUM_KETEMU",
    side: "order",
    stage: "MENUNGGU_CAIR",
    isEstimasi: true,
    flags: [],
    releasedAt: null,
    orderCreatedAt: null,
    ...over,
  };
}

function reconResult(items: ReconItem[]): ReconResult {
  return {
    rate: { match: 0, selisih: 0, belumKetemu: 0, total: 0, matchPct: 0 },
    totals: { estimasi: 0, aktual: 0, selisih: 0, adjustment: 0 },
    payoutRatio: 1,
    items,
    adjustments: [],
  };
}

// Regresi bug "Laporan Profit pakai Estimasi, bukan Aktual" — Uang Cair/Profit HPP di
// laporan per-SKU harus ikut nilai Income Report yang sudah match (aktual), BUKAN
// Order.netSettlement yang cuma estimasi dari file Pesanan.
describe("buildActualLookup + allocateActual", () => {
  it("order sudah match -> aktual dipakai (beda dari estimasi)", () => {
    const recon = reconResult([reconItem({ orderSn: "SN1", estimasi: 120000, aktual: 69000, isEstimasi: false })]);
    const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(recon);
    expect(estimasiByOrderSn.get("SN1")).toBe(120000);
    expect(aktualByOrderSn.get("SN1")).toBe(69000);

    const lineAktual = allocateActual(120000, 120000, aktualByOrderSn.get("SN1"));
    expect(lineAktual).toBe(69000);
    expect(lineAktual).not.toBe(120000); // -> uangCair harus BEDA dari omzet/estimasi
  });

  it("order belum match (Menunggu Cair) -> allocateActual return null, TIDAK dihitung 0", () => {
    const recon = reconResult([reconItem({ orderSn: "SN2", estimasi: 50000, aktual: null })]);
    const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(recon);
    expect(aktualByOrderSn.has("SN2")).toBe(false);

    const lineAktual = allocateActual(50000, estimasiByOrderSn.get("SN2")!, aktualByOrderSn.get("SN2"));
    expect(lineAktual).toBeNull();
  });

  it("order multi-item (2 baris SKU, 1 payout) -> aktual dialokasikan proporsional per baris", () => {
    // No. Pesanan SN3: baris A estimasi 80.000, baris B estimasi 20.000 (total 100.000),
    // Income Report match dengan aktual 90.000 (potongan lebih kecil dari estimasi kotor).
    const recon = reconResult([reconItem({ orderSn: "SN3", estimasi: 100000, aktual: 90000, isEstimasi: false })]);
    const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(recon);
    const groupEst = estimasiByOrderSn.get("SN3")!;
    const groupAkt = aktualByOrderSn.get("SN3");

    const lineA = allocateActual(80000, groupEst, groupAkt)!;
    const lineB = allocateActual(20000, groupEst, groupAkt)!;
    expect(lineA).toBeCloseTo(72000); // 90.000 * (80.000/100.000)
    expect(lineB).toBeCloseTo(18000); // 90.000 * (20.000/100.000)
    expect(lineA + lineB).toBeCloseTo(90000); // total teralokasi = aktual order, bukan estimasi
  });

  it("groupEstimasi 0 -> tidak divide-by-zero, hasil 0 bukan NaN/Infinity", () => {
    expect(allocateActual(0, 0, 50000)).toBe(0);
  });
});
