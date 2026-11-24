import { describe, it, expect } from "vitest";
import { fitTabs } from "@/lib/fitTabs";

// T-013 butir 12 / 12b: tab yang tidak muat masuk "Lainnya", urutan tetap; tab pinned selalu tampil.
const W = [100, 150, 140, 120, 120, 150, 130]; // total 910
const MORE = 90;
const count = (v: boolean[]) => v.filter(Boolean).length;
const isPrefix = (v: boolean[], k: number) => v.every((x, i) => x === i < k);

describe("fitTabs tanpa pinned (perilaku butir 12)", () => {
  it("semua muat -> semua tampil, tanpa Lainnya", () => {
    expect(fitTabs(W, 918, MORE).every(Boolean)).toBe(true); // 910 + padding 8
  });
  it("kurang 1px -> tab paling belakang pindah ke Lainnya, sisa + tombol Lainnya muat", () => {
    const v = fitTabs(W, 917, MORE);
    const k = count(v);
    expect(k).toBeLessThan(7);
    expect(isPrefix(v, k)).toBe(true);
    const used = W.slice(0, k).reduce((a, b) => a + b, 0) + 8 + 4 + MORE;
    expect(used).toBeLessThanOrEqual(917);
    expect(used + W[k]).toBeGreaterThan(917); // tab berikutnya memang tidak muat
  });
  it("lebar laptop kecil -> jumlah tab turun bertahap", () => {
    expect(isPrefix(fitTabs(W, 700, MORE), 4)).toBe(true); // 8+4+90 + 100+150+140+120 = 612
    expect(isPrefix(fitTabs(W, 400, MORE), 2)).toBe(true);
  });
  it("ruang sangat sempit -> minimal 1 tab tetap tampil", () => {
    expect(isPrefix(fitTabs(W, 50, MORE), 1)).toBe(true);
  });
});

// Lebar ASLI tab menu (diukur di Chrome, font Poppins 13px, 2026-11-24) urut navConfig,
// dan ruang tab yang tersedia di tiap lebar layar (Owner, sidebar rail, TopBar lengkap).
const MENU = ["Dashboard", "Input & Import Data", "Keuangan & Rekon", "Laporan Profit", "Performa Toko", "Retur & Pembatalan", "Laporan Rekapan"];
const REAL_W = [105.15, 161.55, 156.83, 122.93, 127.18, 164.39, 147.64];
const REAL_MORE = 101.28;
const RUANG = { 1366: 910, 1280: 824, 1024: 699 } as const;
const PIN = MENU.map((m) => m === "Retur & Pembatalan");
const RETUR = MENU.indexOf("Retur & Pembatalan");

describe("fitTabs dengan pinned: Retur & Pembatalan selalu tampil (butir 12b)", () => {
  it.each([
    [1366, ["Dashboard", "Input & Import Data", "Keuangan & Rekon", "Laporan Profit", "Retur & Pembatalan"]],
    [1280, ["Dashboard", "Input & Import Data", "Keuangan & Rekon", "Retur & Pembatalan"]],
    [1024, ["Dashboard", "Input & Import Data", "Retur & Pembatalan"]],
  ] as const)("lebar %d: pinned tampil, yang lain dibuang dari belakang, urutan tetap", (lebar, tampil) => {
    const v = fitTabs(REAL_W, RUANG[lebar], REAL_MORE, PIN);
    expect(v[RETUR]).toBe(true);
    expect(MENU.filter((_, i) => v[i])).toEqual(tampil); // urutan = urutan navConfig
  });

  it.each([1366, 1280, 1024] as const)("lebar %d: tab yang tampil (termasuk pinned) + tombol Lainnya muat, tidak terpotong", (lebar) => {
    const v = fitTabs(REAL_W, RUANG[lebar], REAL_MORE, PIN);
    const used = REAL_W.reduce((a, w, i) => a + (v[i] ? w : 0), 0) + 8 + 4 + REAL_MORE;
    expect(used).toBeLessThanOrEqual(RUANG[lebar]);
  });

  it("semua muat (mis. 1920 px, ruang 1309) -> semua tampil, tanpa Lainnya", () => {
    expect(fitTabs(REAL_W, 1309, REAL_MORE, PIN).every(Boolean)).toBe(true);
  });

  it("tanpa pinned, 1024 px memasukkan Retur ke Lainnya (bukti pin yang menahannya)", () => {
    expect(fitTabs(REAL_W, RUANG[1024], REAL_MORE)[RETUR]).toBe(false);
  });

  it("ruang sangat sempit -> pinned tetap tampil walau tab lain semua masuk Lainnya", () => {
    const v = fitTabs(REAL_W, 100, REAL_MORE, PIN);
    expect(MENU.filter((_, i) => v[i])).toEqual(["Retur & Pembatalan"]);
  });
});
