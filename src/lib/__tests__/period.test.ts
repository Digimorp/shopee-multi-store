import { describe, it, expect } from "vitest";
import {
  getPeriodForMonth,
  formatPeriodMonthLabel,
  getPeriodForDate,
  parsePeriodKey,
  makePeriod,
} from "@/lib/period";

// Waktu WIB ditulis eksplisit dengan offset +07:00 supaya test tidak bergantung zona waktu mesin.
const wib = (s: string) => new Date(`${s}+07:00`);
const inPeriod = (d: Date, p: { from: Date; to: Date }) => d >= p.from && d <= p.to;

describe("getPeriodForMonth — batas jam WIB", () => {
  const jan = getPeriodForMonth("2027-01", 25);

  it("mulai tgl 26 jam 00:00:00.000 WIB dan berakhir tgl 25 jam 23:59:59.999 WIB", () => {
    expect(jan.from.toISOString()).toBe("2026-12-25T17:00:00.000Z"); // = 26 Des 2026 00:00 WIB
    expect(jan.to.toISOString()).toBe("2027-01-25T16:59:59.999Z"); // = 25 Jan 2027 23:59:59.999 WIB
  });

  it("pesanan tgl 26 jam 00:00 WIB masuk periode; 1 ms sebelumnya masuk periode sebelumnya", () => {
    expect(inPeriod(wib("2026-12-26T00:00:00.000"), jan)).toBe(true);
    expect(inPeriod(wib("2026-12-25T23:59:59.999"), jan)).toBe(false);
    expect(inPeriod(wib("2026-12-25T23:59:59.999"), getPeriodForMonth("2026-12", 25))).toBe(true);
  });

  it("pesanan tgl 25 jam 23:59:59.999 WIB masih masuk; tgl 26 jam 00:00 WIB sudah bulan berikutnya", () => {
    expect(inPeriod(wib("2027-01-25T23:59:59.999"), jan)).toBe(true);
    expect(inPeriod(wib("2027-01-26T00:00:00.000"), jan)).toBe(false);
    expect(inPeriod(wib("2027-01-26T00:00:00.000"), getPeriodForMonth("2027-02", 25))).toBe(true);
  });

  it("pesanan tgl 26 jam 03:00 WIB (= tgl 25 20:00 UTC) tetap masuk periode bulan berikutnya", () => {
    const d = wib("2027-01-26T03:00:00");
    expect(d.toISOString()).toBe("2027-01-25T20:00:00.000Z");
    expect(inPeriod(d, getPeriodForMonth("2027-02", 25))).toBe(true);
    expect(inPeriod(d, jan)).toBe(false);
  });
});

describe("getPeriodForMonth — pergantian tahun & Februari", () => {
  it("Januari: periode mulai di Desember tahun sebelumnya, key sama format dengan periodKey tersimpan", () => {
    expect(getPeriodForMonth("2027-01", 25).key).toBe("2026-12-26_2027-01-25");
  });

  it("Februari tahun biasa dan kabisat (cutoff 25)", () => {
    expect(getPeriodForMonth("2027-02", 25).key).toBe("2027-01-26_2027-02-25");
    expect(getPeriodForMonth("2028-02", 25).key).toBe("2028-01-26_2028-02-25");
    expect(getPeriodForMonth("2027-03", 25).key).toBe("2027-02-26_2027-03-25");
  });

  it("cutoff 30 di Februari: dipotong ke hari terakhir bulan, periode tetap bersambung", () => {
    expect(getPeriodForMonth("2027-02", 30).key).toBe("2027-01-31_2027-02-28");
    expect(getPeriodForMonth("2027-03", 30).key).toBe("2027-03-01_2027-03-30");
    expect(getPeriodForMonth("2028-02", 30).key).toBe("2028-01-31_2028-02-29");
    expect(getPeriodForMonth("2028-03", 30).key).toBe("2028-03-01_2028-03-30");
  });

  it("24 bulan berturut-turut bersambung tanpa celah/tumpang tindih (to + 1 ms = from berikutnya)", () => {
    for (const cutoff of [25, 28, 30, 31]) {
      let y = 2026;
      let m = 1;
      let prev = getPeriodForMonth("2026-01", cutoff);
      for (let i = 0; i < 24; i++) {
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
        const cur = getPeriodForMonth(`${y}-${String(m).padStart(2, "0")}`, cutoff);
        expect(cur.from.getTime()).toBe(prev.to.getTime() + 1);
        prev = cur;
      }
    }
  });

  it("input tidak valid ditolak", () => {
    expect(() => getPeriodForMonth("2027-13", 25)).toThrow();
    expect(() => getPeriodForMonth("2027-1", 25)).toThrow();
    expect(() => getPeriodForMonth("2027-01", 0)).toThrow();
    expect(() => getPeriodForMonth("2027-01", 32)).toThrow();
  });
});

describe("formatPeriodMonthLabel — nama bulan akhir periode (bahasa Indonesia)", () => {
  it("memakai bulan AKHIR periode", () => {
    expect(formatPeriodMonthLabel(getPeriodForMonth("2027-01", 25))).toBe("Januari 2027");
    expect(formatPeriodMonthLabel(getPeriodForMonth("2027-02", 30))).toBe("Februari 2027");
  });

  it("12 nama bulan lengkap", () => {
    const names = Array.from({ length: 12 }, (_, i) =>
      formatPeriodMonthLabel(getPeriodForMonth(`2027-${String(i + 1).padStart(2, "0")}`, 25))
    );
    expect(names).toEqual([
      "Januari 2027",
      "Februari 2027",
      "Maret 2027",
      "April 2027",
      "Mei 2027",
      "Juni 2027",
      "Juli 2027",
      "Agustus 2027",
      "September 2027",
      "Oktober 2027",
      "November 2027",
      "Desember 2027",
    ]);
  });

  it("berlaku juga untuk periodKey tersimpan (parsePeriodKey)", () => {
    expect(formatPeriodMonthLabel(parsePeriodKey("2026-12-26_2027-01-25"))).toBe("Januari 2027");
  });
});

describe("fungsi lama tidak berubah perilakunya", () => {
  it("getPeriodForDate & makePeriod: key tetap sama seperti sebelumnya", () => {
    expect(getPeriodForDate(new Date(2027, 0, 10, 12), 25).key).toBe("2026-12-26_2027-01-25");
    expect(getPeriodForDate(new Date(2027, 0, 27, 12), 25).key).toBe("2027-01-26_2027-02-25");
    expect(makePeriod(new Date(2027, 0, 1), new Date(2027, 0, 31)).key).toBe("2027-01-01_2027-01-31");
  });
});

// T-013 batch 16: nama periode = rentang tanggal (bukan nama bulan saja). Dijalankan di WIB & UTC.
describe("formatPeriodRangeLabel — nama periode = rentang tanggal", () => {
  it("26 Jun - 25 Jul 2026 dan lintas tahun", async () => {
    const { formatPeriodRangeLabel, formatDateRangeLabel } = await import("@/lib/period");
    expect(formatPeriodRangeLabel(getPeriodForMonth("2026-07", 25))).toBe("26 Jun - 25 Jul 2026");
    expect(formatPeriodRangeLabel(getPeriodForMonth("2027-01", 25))).toBe("26 Des 2026 - 25 Jan 2027");
    expect(formatPeriodRangeLabel(parsePeriodKey("2026-12-26_2027-01-25"))).toBe("26 Des 2026 - 25 Jan 2027");
    expect(formatPeriodRangeLabel({ key: "2026-07-26_2026-08-25" })).toBe("26 Jul - 25 Agu 2026");
    expect(formatDateRangeLabel(new Date("2026-07-25T17:00:00Z"), new Date("2026-08-25T16:59:59Z"))).toBe("26 Jul - 25 Agu 2026");
  });
  it("cutoff lain (20) memberi rentang yang benar", async () => {
    const { formatPeriodRangeLabel } = await import("@/lib/period");
    expect(formatPeriodRangeLabel(getPeriodForMonth("2026-07", 20))).toBe("21 Jun - 20 Jul 2026");
    expect(formatPeriodRangeLabel(getPeriodForMonth("2026-03", 30))).toBe("1 Mar - 30 Mar 2026");
  });
  it("4 periode di dropdown", async () => {
    const { formatPeriodRange } = await import("@/lib/periodPicker");
    expect(["2026-07", "2026-08", "2026-09", "2026-10"].map((m) => formatPeriodRange(m, 25))).toEqual([
      "26 Jun - 25 Jul 2026",
      "26 Jul - 25 Agu 2026",
      "26 Agu - 25 Sep 2026",
      "26 Sep - 25 Okt 2026",
    ]);
  });
});
