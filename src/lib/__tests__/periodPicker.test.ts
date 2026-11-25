import { describe, it, expect } from "vitest";
import { convertLegacyRange, formatPeriodRange } from "@/lib/periodPicker";

// T-013 batch 15 (bagian C). Dijalankan di TZ=Asia/Jakarta dan TZ=UTC (hasil harus sama).
describe("formatPeriodRange", () => {
  it("rentang asli periode cut-off", () => {
    expect(formatPeriodRange("2026-10", 25)).toBe("26 Sep - 25 Okt 2026");
    expect(formatPeriodRange("2027-01", 25)).toBe("26 Des 2026 - 25 Jan 2027");
    expect(formatPeriodRange("2026-03", 30)).toBe("1 Mar - 30 Mar 2026");
  });
});

describe("convertLegacyRange (link lama from/to -> period)", () => {
  const conv = (qs: string) => convertLegacyRange(new URLSearchParams(qs), 25)?.toString() ?? null;
  it("from/to -> period yang memuat tanggal to; param lain ikut", () => {
    expect(conv("storeId=s1&from=2026-09-26&to=2026-10-25&tab=profit")).toBe("storeId=s1&tab=profit&period=2026-10");
    expect(conv("to=2026-10-26")).toBe("period=2026-11");
    expect(conv("from=2026-08-26")).toBe("period=2026-09");
    expect(conv("from=2026-08-26T00:00:00.000Z&to=rusak")).toBe("period=2026-09");
  });
  it("period sudah ada -> from/to dibuang saja; tanpa from/to -> tidak diubah", () => {
    expect(conv("period=2026-07&from=2026-01-01&to=2026-01-31")).toBe("period=2026-07");
    expect(conv("storeId=s1&period=2026-07")).toBeNull();
  });
  it("from/to rusak semua -> dibuang, jatuh ke default (bulan berjalan)", () => {
    expect(conv("storeId=s1&from=x&to=y")).toBe("storeId=s1");
  });
});
