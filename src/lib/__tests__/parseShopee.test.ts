import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseShopeeFile } from "@/lib/parseShopee";

// Header mengikuti skema resmi export Pesanan Shopee (subset kolom yang dipakai parser).
const HEADER = [
  "No. Pesanan",
  "Status Pesanan",
  "No. Resi",
  "Waktu Pesanan Dibuat",
  "Waktu Pembayaran Dilakukan",
  "SKU Induk",
  "Nama Produk",
  "Nomor Referensi SKU",
  "Nama Variasi",
  "Harga Awal",
  "Harga Setelah Diskon",
  "Jumlah",
  "Returned quantity",
  "Subtotal Pesanan",
  "Total Pembayaran",
  "Waktu Pesanan Selesai",
];

function build(rows: (string | number)[][], sheetName = "orders"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("parseShopeeFile — skema resmi 50 kolom", () => {
  it("parse nominal titik-ribuan jadi integer (bukan parseFloat)", () => {
    const buf = build([
      ["260726MDGRS85M", "Selesai", "SPXID001", "2026-07-26 01:01", "2026-07-26 23:53", "IK-02", "Riyadhus Shalihin", "IK-02", "", "165.000", "123.750", "2", "0", "247.500", "225.750", "2026-07-29 15:53"],
    ]);
    const { rows, errors } = parseShopeeFile(buf);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.orderSn).toBe("260726MDGRS85M");
    expect(r.unitPrice).toBe(123750); // "Harga Setelah Diskon" diprioritaskan
    expect(r.subtotal).toBe(247500);
    expect(r.totalPayment).toBe(225750);
    expect(r.netSettlementRaw).toBe(247500); // fallback ke Subtotal (tak ada kolom penghasilan)
    expect(r.qty).toBe(2);
    expect(r.sku).toBe("IK-02");
    expect(r.settlementColumnPresent).toBe(false);
    expect(r.completedAt).toBeInstanceOf(Date);
  });

  it("Jumlah bisa angka atau string", () => {
    const buf = build([
      ["A1", "Selesai", "", "2026-07-26 01:01", "", "IK-1", "P1", "IK-1", "", "10.000", "10.000", 12, "0", "120.000", "120.000", ""],
      ["A2", "Selesai", "", "2026-07-26 01:02", "", "IK-1", "P1", "IK-1", "", "10.000", "10.000", "1", "0", "10.000", "10.000", ""],
    ]);
    const { rows } = parseShopeeFile(buf);
    expect(rows.map((r) => r.qty)).toEqual([12, 1]);
  });

  it("fallback SKU: pakai SKU Induk kalau Nomor Referensi SKU kosong", () => {
    const buf = build([
      ["A1", "Selesai", "", "2026-07-26 01:01", "", "IK-99", "P", "", "", "10.000", "10.000", "1", "0", "10.000", "10.000", ""],
    ]);
    const { rows } = parseShopeeFile(buf);
    expect(rows[0].sku).toBe("IK-99");
    expect(rows[0].skuInduk).toBe("IK-99");
  });

  it("pesanan multi-item: beberapa baris dengan No. Pesanan sama tetap jadi baris terpisah", () => {
    const buf = build([
      ["ORD1", "Selesai", "", "2026-07-26 01:01", "", "IK-31", "Bulughul Maram", "IK-31", "", "129.000", "96.750", "1", "0", "96.750", "174.906", "2026-07-30 21:11"],
      ["ORD1", "Selesai", "", "2026-07-26 01:01", "", "IK-02", "Riyadhus Shalihin", "IK-02", "", "165.000", "123.750", "1", "0", "123.750", "174.906", "2026-07-30 21:11"],
    ]);
    const { rows } = parseShopeeFile(buf);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.orderSn === "ORD1")).toBe(true);
    expect(rows.map((r) => r.subtotal)).toEqual([96750, 123750]);
    expect(rows.map((r) => r.totalPayment)).toEqual([174906, 174906]);
  });

  it("pilih sheet 'orders' walau bukan sheet pertama", () => {
    const ws1 = XLSX.utils.aoa_to_sheet([["x"], ["y"]]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      HEADER,
      ["A1", "Selesai", "", "2026-07-26 01:01", "", "IK-1", "P", "IK-1", "", "10.000", "10.000", "1", "0", "10.000", "10.000", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Cover");
    XLSX.utils.book_append_sheet(wb, ws2, "orders");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const { rows, errors } = parseShopeeFile(buf);
    expect(errors).toHaveLength(0);
    expect(rows[0].orderSn).toBe("A1");
  });

  it("format lama (punya 'Waktu Dana Dilepaskan') -> settlementColumnPresent true", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [...HEADER, "Total Penghasilan", "Waktu Dana Dilepaskan"],
      ["A1", "Selesai", "", "2026-07-26 01:01", "", "IK-1", "P", "IK-1", "", "10.000", "10.000", "1", "0", "10.000", "10.000", "", "9.000", "2026-07-30 10:00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "orders");
    const { rows } = parseShopeeFile(Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(rows[0].settlementColumnPresent).toBe(true);
    expect(rows[0].hasSettlementDate).toBe(true);
    expect(rows[0].netSettlementRaw).toBe(9000); // pakai "Total Penghasilan" kalau ada
  });

  it("error spesifik menyebut kolom wajib yang hilang", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Foo", "Bar"], [1, 2]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const { rows, errors } = parseShopeeFile(Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/No\. Pesanan/);
    expect(errors[0].message).toMatch(/Status Pesanan/);
    expect(errors[0].message).toMatch(/Nama Produk/);
  });
});
