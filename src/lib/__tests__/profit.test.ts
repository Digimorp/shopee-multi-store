import { describe, it, expect } from "vitest";
import { calcProfitHpp, calcProfitAgen, calcSelisihProfit } from "@/lib/profit";

describe("calcProfitHpp = netSettlement - hpp * qty", () => {
  it("SKU-001 x3: uang cair 66.000, hpp 8.000/unit -> 42.000", () => {
    expect(calcProfitHpp({ netSettlement: 66000, hpp: 8000, qty: 3 })).toBe(42000);
  });

  it("bisa negatif kalau uang cair < modal", () => {
    expect(calcProfitHpp({ netSettlement: 10000, hpp: 8000, qty: 2 })).toBe(-6000);
  });

  it("qty 0 -> profit = netSettlement", () => {
    expect(calcProfitHpp({ netSettlement: 5000, hpp: 8000, qty: 0 })).toBe(5000);
  });
});

describe("calcProfitAgen = (hargaKatalog*0.5 - hpp) * qty", () => {
  it("SKU-001 x3: katalog 25.000 -> agen 12.500, hpp 8.000 -> 13.500", () => {
    expect(calcProfitAgen({ catalogPrice: 25000, hpp: 8000, qty: 3 })).toBe(13500);
  });

  it("SKU-002 x1: katalog 150.000 -> agen 75.000, hpp 65.000 -> 10.000", () => {
    expect(calcProfitAgen({ catalogPrice: 150000, hpp: 65000, qty: 1 })).toBe(10000);
  });

  it("tidak bergantung netSettlement (benchmark harga agen)", () => {
    expect(calcProfitAgen({ catalogPrice: 120000, hpp: 45000, qty: 1 })).toBe(15000);
  });

  it("rugi kalau HPP > separuh katalog", () => {
    expect(calcProfitAgen({ catalogPrice: 100000, hpp: 60000, qty: 2 })).toBe(-20000);
  });
});

describe("calcSelisihProfit = profitAgen - profitHpp", () => {
  it("15.000 vs 65.000 -> -50.000", () => {
    expect(calcSelisihProfit(15000, 65000)).toBe(-50000);
  });
});
