import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  deriveStage,
  MATCH_TOLERANCE,
  FINAL_LOCK_DAYS,
  buildActualLookup,
  allocateActual,
  allocateLines,
  deriveSettleStatus,
  isRefundEntry,
  type ReconResult,
  type ReconItem,
} from "@/lib/reconciliation";
import { diffReconItems, settlementBreakdown } from "@/lib/settlement";

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
    settleStatus: "BELUM",
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

// Status pencairan per No. Pesanan: diturunkan dari status tiap baris SKU + entri income,
// tidak disimpan (jadi tidak bisa out-of-sync dengan baris-barisnya).
describe("deriveSettleStatus", () => {
  const penghasilan = { hasRefund: false };

  it("belum ada payout -> BELUM (walau baris SELESAI)", () => {
    expect(deriveSettleStatus([{ status: OrderStatus.SELESAI }, { status: OrderStatus.SELESAI }], null)).toBe("BELUM");
  });

  it("semua baris terjual + payout tanpa refund -> AKTUAL", () => {
    expect(deriveSettleStatus([{ status: OrderStatus.SELESAI }, { status: OrderStatus.SELESAI }], penghasilan)).toBe(
      "AKTUAL"
    );
  });

  it("order 2 baris: 1 cair (SELESAI), 1 tidak (RETUR) + ada payout -> SEBAGIAN, bukan AKTUAL/BELUM", () => {
    expect(deriveSettleStatus([{ status: OrderStatus.SELESAI }, { status: OrderStatus.RETUR }], penghasilan)).toBe(
      "SEBAGIAN"
    );
  });

  it("payout + entri pengembalian dana -> SEBAGIAN", () => {
    expect(deriveSettleStatus([{ status: OrderStatus.SELESAI }], { hasRefund: true })).toBe("SEBAGIAN");
  });
});

describe("isRefundEntry", () => {
  it("'Penghasilan dari Pesanan' positif -> bukan refund", () => {
    expect(isRefundEntry({ amount: 42805, raw: { "Tipe Transaksi": "Penghasilan dari Pesanan" } })).toBe(false);
  });
  it("nominal negatif / tipe pengembalian -> refund", () => {
    expect(isRefundEntry({ amount: -15000, raw: {} })).toBe(true);
    expect(isRefundEntry({ amount: 15000, raw: { "Tipe Transaksi": "Pengembalian Dana" } })).toBe(true);
  });
});

// Regresi bug dedup di tab Uang Cair /rekonsiliasi: tabel 1 baris per SKU, tapi payout Shopee
// 1 per No. Pesanan. Dulu payout order ditempel utuh ke TIAP baris -> order 2 baris dihitung 2x.
describe("allocateLines — order multi-SKU tidak dihitung dobel", () => {
  // Data nyata dari DB lokal: 260901VDU7KCHV = 2 baris (estimasi 21.250 + 59.000),
  // Income Report 1 entri "Penghasilan dari Pesanan" Rp 42.805 untuk seluruh order.
  const SN = "260901VDU7KCHV";
  const lines = [
    { id: "a", orderSn: SN, netSettlement: 21250, status: OrderStatus.SELESAI },
    { id: "b", orderSn: SN, netSettlement: 59000, status: OrderStatus.SELESAI },
  ];
  const byOrderSn = new Map<string, { estimasi: number; aktual: number | null }>([
    [SN, { estimasi: 80250, aktual: 42805 }],
  ]);

  it("260901VDU7KCHV: total aktual = 42.805 (sekali), BUKAN 85.610 (2x)", () => {
    const { perLine, total, matchedOrders } = allocateLines(lines, byOrderSn);
    expect(total).toBeCloseTo(42805);
    expect(total).not.toBeCloseTo(85610);
    expect(matchedOrders).toBe(1); // 1 order, bukan 2 baris
    // Tiap baris dapat porsinya, tidak lagi "disamakan" 42.805 semua.
    expect(perLine[0]).toBeCloseTo(42805 * (21250 / 80250));
    expect(perLine[1]).toBeCloseTo(42805 * (59000 / 80250));
    expect(perLine[0]).not.toBeCloseTo(perLine[1]!);
  });

  it("260901VDU7KCHV: kedua baris SELESAI + 1 payout tanpa refund -> AKTUAL (data tak menunjukkan cair sebagian)", () => {
    expect(deriveSettleStatus(lines, { hasRefund: false })).toBe("AKTUAL");
  });

  it("order 2 baris, 1 SELESAI 1 RETUR: payout tidak dobel DAN status SEBAGIAN", () => {
    const mixed = [
      { id: "c", orderSn: "SN-MIX", netSettlement: 60000, status: OrderStatus.SELESAI },
      { id: "d", orderSn: "SN-MIX", netSettlement: 40000, status: OrderStatus.RETUR },
    ];
    const map = new Map([["SN-MIX", { estimasi: 100000, aktual: 38000 }]]);
    const { total, matchedOrders } = allocateLines(mixed, map);
    expect(total).toBeCloseTo(38000);
    expect(matchedOrders).toBe(1);
    expect(deriveSettleStatus(mixed, { hasRefund: false })).toBe("SEBAGIAN");
  });

  it("campuran order cair + belum cair -> baris belum cair null, tidak ikut total", () => {
    const rows = [...lines, { id: "e", orderSn: "SN-BELUM", netSettlement: 50000, status: OrderStatus.SELESAI }];
    const map = new Map(byOrderSn).set("SN-BELUM", { estimasi: 50000, aktual: null });
    const { perLine, total, matchedOrders } = allocateLines(rows, map);
    expect(perLine[2]).toBeNull();
    expect(total).toBeCloseTo(42805);
    expect(matchedOrders).toBe(1);
  });
});

// "Sync ulang" di /rekonsiliasi: hitung ulang reconcile() lalu bandingkan dengan hasil yang tampil.
describe("diffReconItems", () => {
  const base = { side: "both", category: "MATCH", settleStatus: "AKTUAL", stage: "CAIR", aktual: 1000 };

  it("hasil identik -> 0 berubah", () => {
    const items = [{ orderSn: "A", ...base }, { orderSn: "B", ...base }];
    expect(diffReconItems(items, items.map((i) => ({ ...i })))).toEqual({ changed: 0, added: 0, removed: 0, total: 2 });
  });

  it("order baru ketemu Income Report (BELUM -> AKTUAL) dihitung berubah", () => {
    const prev = [{ orderSn: "A", ...base, category: "BELUM_KETEMU", settleStatus: "BELUM", stage: "MENUNGGU_CAIR", aktual: null }];
    const next = [{ orderSn: "A", ...base }];
    expect(diffReconItems(prev, next).changed).toBe(1);
  });

  it("nilai aktual berubah (re-upload Income Report) dihitung berubah; selisih pembulatan < Rp 1 tidak", () => {
    expect(diffReconItems([{ orderSn: "A", ...base }], [{ orderSn: "A", ...base, aktual: 900 }]).changed).toBe(1);
    expect(diffReconItems([{ orderSn: "A", ...base }], [{ orderSn: "A", ...base, aktual: 1000.2 }]).changed).toBe(0);
  });

  it("order baru / hilang dihitung terpisah", () => {
    const d = diffReconItems([{ orderSn: "A", ...base }], [{ orderSn: "B", ...base }]);
    expect(d).toEqual({ changed: 0, added: 1, removed: 1, total: 1 });
  });
});

// Popup Settlement Details: breakdown per SKU 1 order, rumus sama dengan Laporan Profit.
describe("settlementBreakdown", () => {
  const line = (o: Partial<Parameters<typeof settlementBreakdown>[0][number]>) => ({
    id: "x", sku: "", productName: "P", qty: 1, status: "SELESAI", grossOmzet: 0, netSettlement: 0, hppSnapshot: 0, profitAgen: 0, ...o,
  });
  // 260901VDU7KCHV (data lokal): 2 baris, estimasi 21.250 + 59.000, payout 42.805. HPP & profit agen sintetis.
  const lines = [
    line({ id: "a", productName: "alma'tsurat", grossOmzet: 21250, netSettlement: 21250, hppSnapshot: 8000, profitAgen: 2000 }),
    line({ id: "b", productName: "madinah a7 rest", grossOmzet: 59000, netSettlement: 59000, hppSnapshot: 20000, profitAgen: 9000 }),
  ];

  it("Uang Cair per SKU = porsi payout, total = payout order (tidak dobel)", () => {
    const { rows, totals } = settlementBreakdown(lines, { estimasi: 80250, aktual: 42805 });
    expect(rows[0].uangCair).toBeCloseTo(42805 * (21250 / 80250));
    expect(totals.uangCair).toBeCloseTo(42805);
    expect(totals.grossOmzet).toBe(80250);
  });

  it("Profit HPP = Uang Cair − HPP×qty; Selisih = Profit Agen − Profit HPP (sama dengan Laporan Profit)", () => {
    const { rows, totals } = settlementBreakdown(lines, { estimasi: 80250, aktual: 42805 });
    expect(rows[1].profitHpp).toBeCloseTo(rows[1].uangCair! - 20000);
    expect(rows[1].selisih).toBeCloseTo(9000 - rows[1].profitHpp!);
    expect(totals.profitHpp).toBeCloseTo(42805 - 28000);
    expect(totals.selisih).toBeCloseTo(11000 - (42805 - 28000));
  });

  it("order belum cair -> Uang Cair/Profit HPP/Selisih null (bukan 0), Profit Agen tetap", () => {
    const { rows, totals } = settlementBreakdown(lines, { estimasi: 80250, aktual: null });
    expect(rows.every((r) => r.uangCair === null && r.profitHpp === null && r.selisih === null)).toBe(true);
    expect(totals.uangCair).toBeNull();
    expect(totals.profitAgen).toBe(11000);
  });

  it("baris CANCEL tidak ikut breakdown", () => {
    const { rows } = settlementBreakdown([...lines, line({ id: "c", status: "CANCEL", grossOmzet: 5000 })], {
      estimasi: 80250,
      aktual: 42805,
    });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
