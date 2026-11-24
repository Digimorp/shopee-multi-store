import { describe, it, expect } from "vitest";
import { fitTabs } from "@/lib/fitTabs";

// T-013 butir 12: tab yang tidak muat masuk "Lainnya", urutan tetap.
const W = [100, 150, 140, 120, 120, 150, 130]; // total 910
const MORE = 90;

describe("fitTabs", () => {
  it("semua muat -> semua tampil, tanpa Lainnya", () => {
    expect(fitTabs(W, 918, MORE)).toBe(7); // 910 + padding 8
  });
  it("kurang 1px -> sebagian pindah ke Lainnya, sisa ruang cukup untuk tombol Lainnya", () => {
    const k = fitTabs(W, 917, MORE);
    expect(k).toBeLessThan(7);
    const used = W.slice(0, k).reduce((a, b) => a + b, 0) + 8 + 4 + MORE;
    expect(used).toBeLessThanOrEqual(917);
    expect(used + W[k]).toBeGreaterThan(917); // tab berikutnya memang tidak muat
  });
  it("lebar laptop kecil -> jumlah tab turun bertahap", () => {
    expect(fitTabs(W, 700, MORE)).toBe(4); // 8+4+90 + 100+150+140+120 = 612; +120 = 732 > 700
    expect(fitTabs(W, 400, MORE)).toBe(2);
  });
  it("ruang sangat sempit -> minimal 1 tab tetap tampil", () => {
    expect(fitTabs(W, 50, MORE)).toBe(1);
  });
});
