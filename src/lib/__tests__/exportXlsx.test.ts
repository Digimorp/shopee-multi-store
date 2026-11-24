import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildXlsx, type ExportColumn } from "@/lib/export";

// T-013 butir 14: export Excel memuat subjudul periode (sama dengan PDF) bila period ada.
// File hasil dibaca balik dengan exceljs: kolom, header, angka, dan format tidak boleh bergeser diam-diam.
const COLS: ExportColumn[] = [
  { header: "SKU", key: "sku", width: 12 },
  { header: "Produk", key: "produk", width: 20 },
  { header: "Unit", key: "qty", kind: "int" },
  { header: "Uang Cair", key: "uangCair", kind: "money" },
  { header: "Kontribusi", key: "share", kind: "pct" },
];
const ROWS = [
  { sku: "-", produk: "Produk A", qty: 3, uangCair: 125000, share: 0.25 },
  { sku: "SKU-B", produk: "Produk B", qty: 1, uangCair: 375000, share: 0.75 },
];
const SUMMARY = [{ label: "Total Uang Cair", value: "Rp 500.000" }];
const SUB = "Periode Agustus 2026  -  2 toko";

async function read(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  const row = (n: number) => (ws.getRow(n).values as any[]).slice(1);
  return { ws, row };
}

describe("buildXlsx subjudul periode", () => {
  it("dengan subtitle: baris 1 subjudul, baris 2 kosong, header baris 3, data mulai baris 4", async () => {
    const { ws, row } = await read(await buildXlsx("Laporan Profit", COLS, ROWS, SUMMARY, SUB));
    expect(row(1)).toEqual([SUB]);
    expect(ws.getRow(1).font?.bold).toBe(true);
    expect(row(2)).toEqual([]);
    expect(row(3)).toEqual(["SKU", "Produk", "Unit", "Uang Cair", "Kontribusi"]);
    expect(ws.getRow(3).font?.bold).toBe(true);
    expect(row(4)).toEqual(["-", "Produk A", 3, 125000, 0.25]);
    expect(row(5)).toEqual(["SKU-B", "Produk B", 1, 375000, 0.75]);
    // angka tetap angka + format kolom tetap
    expect(typeof ws.getCell("D4").value).toBe("number");
    expect(ws.getCell("D4").numFmt).toBe("#,##0");
    expect(ws.getCell("E5").numFmt).toBe("0.0%");
    // ringkasan di bawah data, tidak menimpa
    expect(row(7)).toEqual(["RINGKASAN"]);
    expect(row(8)).toEqual(["Total Uang Cair", "Rp 500.000"]);
  });

  it("tanpa subtitle (link lama from/to): header tetap di baris 1 seperti sebelumnya", async () => {
    const { ws, row } = await read(await buildXlsx("Laporan Profit", COLS, ROWS, SUMMARY));
    expect(row(1)).toEqual(["SKU", "Produk", "Unit", "Uang Cair", "Kontribusi"]);
    expect(ws.getRow(1).font?.bold).toBe(true);
    expect(row(2)).toEqual(["-", "Produk A", 3, 125000, 0.25]);
    expect(row(5)).toEqual(["RINGKASAN"]);
  });
});
