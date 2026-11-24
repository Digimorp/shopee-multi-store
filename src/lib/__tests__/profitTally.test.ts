import { describe, it, expect } from "vitest";
import {
  isHppKnown,
  lineProfitHpp,
  addProfitLine,
  emptyTally,
  lineProfitAgen,
  addAgenLine,
  emptyAgenTally,
  calcSelisihProfit,
} from "@/lib/profit";

describe("isHppKnown", () => {
  it("HPP > 0 = diketahui; 0 atau negatif = tidak diketahui", () => {
    expect(isHppKnown(8000)).toBe(true);
    expect(isHppKnown(0)).toBe(false);
    expect(isHppKnown(-1)).toBe(false);
  });
});

describe("lineProfitHpp", () => {
  it("HPP diketahui & sudah cair -> uangCair - hpp*qty", () => {
    expect(lineProfitHpp({ qty: 3, hppSnapshot: 8000, uangCair: 66000 })).toBe(42000);
  });
  it("HPP diketahui, boleh negatif", () => {
    expect(lineProfitHpp({ qty: 2, hppSnapshot: 8000, uangCair: 10000 })).toBe(-6000);
  });
  it("HPP 0 -> null (bukan profit penuh)", () => {
    expect(lineProfitHpp({ qty: 3, hppSnapshot: 0, uangCair: 66000 })).toBeNull();
  });
  it("belum cair (null) -> null", () => {
    expect(lineProfitHpp({ qty: 3, hppSnapshot: 8000, uangCair: null })).toBeNull();
  });
});

describe("addProfitLine", () => {
  it("HPP diketahui: masuk profit & uang cair, tanpaHpp tetap 0", () => {
    const t = emptyTally();
    addProfitLine(t, { qty: 3, hppSnapshot: 8000, uangCair: 66000 });
    expect(t).toEqual({ profitHpp: 42000, uangCair: 66000, tanpaHpp: { baris: 0, uangCair: 0 } });
  });

  it("HPP 0: tidak masuk profit, masuk uang cair & tanpaHpp", () => {
    const t = emptyTally();
    addProfitLine(t, { qty: 2, hppSnapshot: 0, uangCair: 50000 });
    expect(t).toEqual({ profitHpp: 0, uangCair: 50000, tanpaHpp: { baris: 1, uangCair: 50000 } });
  });

  it("belum cair: diabaikan seluruhnya", () => {
    const t = emptyTally();
    addProfitLine(t, { qty: 2, hppSnapshot: 8000, uangCair: null });
    addProfitLine(t, { qty: 2, hppSnapshot: 0, uangCair: null });
    expect(t).toEqual(emptyTally());
  });

  it("campuran beberapa baris: total & tanpaHpp benar", () => {
    const t = emptyTally();
    const lines = [
      { qty: 3, hppSnapshot: 8000, uangCair: 66000 }, // profit 42.000
      { qty: 1, hppSnapshot: 0, uangCair: 30000 }, // tanpa HPP
      { qty: 2, hppSnapshot: 10000, uangCair: 15000 }, // profit -5.000
      { qty: 4, hppSnapshot: 0, uangCair: 20000 }, // tanpa HPP
      { qty: 5, hppSnapshot: 7000, uangCair: null }, // belum cair
      { qty: 1, hppSnapshot: 0, uangCair: null }, // belum cair, tanpa HPP -> tetap diabaikan
    ];
    for (const l of lines) addProfitLine(t, l);
    expect(t.profitHpp).toBe(37000);
    expect(t.uangCair).toBe(131000);
    expect(t.tanpaHpp).toEqual({ baris: 2, uangCair: 50000 });
    // Uang Cair = bagian ber-HPP + bagian tanpa HPP
    expect(t.uangCair - t.tanpaHpp.uangCair).toBe(81000);
  });

  it("emptyTally mengembalikan objek baru tiap dipanggil", () => {
    const a = emptyTally();
    a.tanpaHpp.baris = 5;
    expect(emptyTally().tanpaHpp.baris).toBe(0);
  });
});

describe("Profit Agen dengan aturan yang sama", () => {
  it("lineProfitAgen: HPP diketahui -> nilai tersimpan; HPP 0 -> null", () => {
    expect(lineProfitAgen({ hppSnapshot: 8000, profitAgen: 13500 })).toBe(13500);
    expect(lineProfitAgen({ hppSnapshot: 0, profitAgen: 37500 })).toBeNull();
  });

  it("addAgenLine campuran: baris tanpa HPP dihitung terpisah", () => {
    const t = emptyAgenTally();
    addAgenLine(t, { hppSnapshot: 8000, profitAgen: 13500 });
    addAgenLine(t, { hppSnapshot: 0, profitAgen: 37500 });
    addAgenLine(t, { hppSnapshot: 10000, profitAgen: -2000 });
    addAgenLine(t, { hppSnapshot: 0, profitAgen: 0 });
    expect(t).toEqual({ profitAgen: 11500, tanpaHpp: { baris: 2 } });
  });

  it("Selisih dihitung dari dua tally yang sama-sama tanpa baris HPP 0", () => {
    const hpp = emptyTally();
    const agen = emptyAgenTally();
    const rows = [
      { qty: 3, hppSnapshot: 8000, uangCair: 66000, profitAgen: 13500 },
      { qty: 1, hppSnapshot: 0, uangCair: 30000, profitAgen: 12500 },
    ];
    for (const r of rows) {
      addProfitLine(hpp, r);
      addAgenLine(agen, r);
    }
    expect(calcSelisihProfit(agen.profitAgen, hpp.profitHpp)).toBe(13500 - 42000);
  });
});
