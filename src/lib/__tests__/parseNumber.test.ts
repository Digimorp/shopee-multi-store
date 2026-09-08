import { describe, it, expect } from "vitest";
import { parseIdNumber } from "@/lib/parseNumber";

describe("parseIdNumber — titik = pemisah ribuan (format resmi Shopee)", () => {
  it("string titik-ribuan tanpa desimal", () => {
    expect(parseIdNumber("1.361.250")).toBe(1361250);
    expect(parseIdNumber("165.000")).toBe(165000);
    expect(parseIdNumber("22.500")).toBe(22500);
    expect(parseIdNumber("48.514")).toBe(48514); // grup terakhir 3 digit -> tetap ribuan
    expect(parseIdNumber("174.906")).toBe(174906);
    expect(parseIdNumber("8.500")).toBe(8500);
    expect(parseIdNumber("0")).toBe(0);
    expect(parseIdNumber("2")).toBe(2);
  });

  it("negatif (Transaksi Keluar / dalam kurung)", () => {
    expect(parseIdNumber("-10.139.555")).toBe(-10139555);
    expect(parseIdNumber("(1.000)")).toBe(-1000);
    expect(parseIdNumber(-12900)).toBe(-12900);
  });

  it("desimal koma ala Indonesia tetap benar", () => {
    expect(parseIdNumber("12.345,67")).toBeCloseTo(12345.67, 2);
    expect(parseIdNumber("1.234.567,89")).toBeCloseTo(1234567.89, 2);
    expect(parseIdNumber("50,5")).toBeCloseTo(50.5, 2);
  });

  it("format EN (koma ribuan, titik desimal)", () => {
    expect(parseIdNumber("1,234,567.89")).toBeCloseTo(1234567.89, 2);
  });

  it("angka asli dari sel Excel diteruskan apa adanya", () => {
    expect(parseIdNumber(40775)).toBe(40775);
    expect(parseIdNumber(0)).toBe(0);
  });

  it("kosong / strip / non-angka -> 0", () => {
    expect(parseIdNumber("")).toBe(0);
    expect(parseIdNumber("-")).toBe(0);
    expect(parseIdNumber(null)).toBe(0);
    expect(parseIdNumber(undefined)).toBe(0);
    expect(parseIdNumber("Rp")).toBe(0);
  });

  it("prefix mata uang & spasi dibersihkan", () => {
    expect(parseIdNumber("Rp 1.361.250")).toBe(1361250);
    expect(parseIdNumber(" 22.500 ")).toBe(22500);
  });

  it("desimal titik pendek (bukan 3-digit) tidak dianggap ribuan", () => {
    expect(parseIdNumber("22.5")).toBeCloseTo(22.5, 2);
    expect(parseIdNumber("1.75")).toBeCloseTo(1.75, 2);
  });
});
