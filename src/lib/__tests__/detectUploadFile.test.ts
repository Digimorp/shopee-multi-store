import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { detectFromBuffer, detectFromSheets } from "@/lib/detectUploadFile";

// T-013 batch 15 (bagian A): deteksi jenis file upload dari struktur.
const book = (sheets: { name: string; rows: unknown[][] }[], bookType: XLSX.BookType = "xlsx") => {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType }));
};
const ORDER_HEAD = ["No. Pesanan", "Status Pesanan", "Nama Produk", "Jumlah", "Subtotal Pesanan", "Waktu Pesanan Dibuat"];
const INCOME_HEAD = ["Tanggal Transaksi", "Tipe Transaksi", "Deskripsi", "No. Pesanan", "Jenis Transaksi", "Jumlah", "Status", "Saldo Akhir"];

describe("deteksi file upload", () => {
  it("Laporan Pesanan (Order.all, sheet orders) -> pesanan", () => {
    const r = detectFromBuffer(book([{ name: "orders", rows: [ORDER_HEAD, ["SN1", "Selesai", "A", 1, 1000, "2026-10-01 10:00"]] }]));
    expect(r).toEqual({ kind: "pesanan", message: "Terdeteksi: Laporan Pesanan" });
  });

  it("Laporan Pesanan format CSV -> pesanan", () => {
    const r = detectFromBuffer(book([{ name: "Sheet1", rows: [ORDER_HEAD, ["SN1", "Selesai", "A", 1, 1000, "2026-10-01"]] }], "csv"));
    expect(r.kind).toBe("pesanan");
  });

  it("Income Report: header tidak di baris 1 (ada baris info di atas) -> income", () => {
    const rows = [["Laporan Saldo Penjual"], ["Periode", "01/10/2026 - 31/10/2026"], [], INCOME_HEAD, ["2026-10-02", "Penghasilan dari Pesanan", "", "SN1", "Transaksi Masuk", 1000, "Selesai", 1000]];
    expect(detectFromBuffer(book([{ name: "Sheet1", rows }])).kind).toBe("income");
  });

  it('Income Report: sheet bernama "Transaction Report" -> income', () => {
    expect(detectFromSheets([{ name: "Transaction Report", rows: [["apa saja"]] }]).kind).toBe("income");
  });

  it("salah format -> null + pesan jelas, tidak diproses", () => {
    const r = detectFromBuffer(book([{ name: "Sheet1", rows: [["Nama", "Alamat"], ["Budi", "Jakarta"]] }]));
    expect(r.kind).toBeNull();
    expect(r.message).toContain("Format tidak dikenali");
    // Pesanan tanpa "Waktu Pesanan Dibuat" juga tidak dianggap Laporan Pesanan
    expect(detectFromSheets([{ name: "orders", rows: [["No. Pesanan", "Status Pesanan"]] }]).kind).toBeNull();
  });

  it("file kosong / rusak -> null", () => {
    expect(detectFromBuffer(book([{ name: "Sheet1", rows: [] }])).message).toBe("File kosong: tidak ada baris data.");
    expect(detectFromSheets([]).kind).toBeNull();
    expect(detectFromBuffer(new Uint8Array([1, 2, 3, 4, 5])).kind).toBeNull();
  });
});
