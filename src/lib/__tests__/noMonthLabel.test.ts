import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// T-013 batch 16: nama periode di UI/export selalu rentang tanggal. Cek kode sumber: tidak ada lagi
// pemanggil formatPeriodMonthLabel (deprecated) dan tidak ada teks "<Bulan> 2026" yang berdiri sendiri.
const SRC = join(__dirname, "..", "..");
const BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("tidak ada sisa label nama bulan di UI", () => {
  it("formatPeriodMonthLabel hanya didefinisikan, tidak dipakai", () => {
    const pakai = files(SRC).filter(
      (f) => !f.endsWith(join("lib", "period.ts")) && readFileSync(f, "utf8").includes("formatPeriodMonthLabel")
    );
    expect(pakai).toEqual([]);
  });
  it('tidak ada string "Juli 2026" dsb. di kode tampilan', () => {
    const re = new RegExp(`["'\`>](${BULAN}) 20\d\d`);
    const hit = files(SRC).filter((f) => !f.endsWith(join("lib", "period.ts")) && re.test(readFileSync(f, "utf8")));
    expect(hit).toEqual([]);
  });
});
