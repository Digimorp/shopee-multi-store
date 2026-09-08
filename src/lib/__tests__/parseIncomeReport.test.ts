import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseIncomeReportFile } from "@/lib/parseIncomeReport";

// Tiru struktur file resmi: 17 baris metadata, header transaksi di baris 18.
function buildIncome(dataRows: (string | number)[][]): Buffer {
  const aoa: (string | number)[][] = [
    ["Laporan"],
    [],
    [],
    [],
    ["Info Rekening"],
    ["Username (Penjual)", "khazanahilmu.id"],
    ["Dari", "2026-07-26"],
    ["Ke", "2026-08-25"],
    ["** Semua perubahan ..."],
    [],
    ["Ringkasan", "", "", "", "$", "Mata Uang", "Jumlah Transaksi"],
    ["Total Saldo Masuk", "", "", "", 70732567, "IDR", 971],
    ["Total Saldo Keluar", "", "", "", -94262175, "IDR", 3],
    [],
    [],
    ["Rincian Transaksi"],
    [],
    ["Tanggal Transaksi", "Tipe Transaksi", "Deskripsi", "No. Pesanan", "Jenis Transaksi", "Jumlah", "Status", "Saldo Akhir"],
    ...dataRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaction Report");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("parseIncomeReportFile — Transaction Report resmi", () => {
  it("deteksi header dinamis di baris 18 & baca transaksi masuk", () => {
    const buf = buildIncome([
      ["2026-08-25 21:54:20", "Penghasilan dari Pesanan", "Penghasilan dari Pesanan #260821UEFHR393", "260821UEFHR393", "Transaksi Masuk", 40775, "Transaksi Selesai", 53699279],
      ["2026-08-25 21:47:50", "Penghasilan dari Pesanan", "Penghasilan dari Pesanan #260815EANRMTHP", "260815EANRMTHP", "Transaksi Masuk", 42137, "Transaksi Selesai", 53658504],
    ]);
    const res = parseIncomeReportFile(buf);
    expect(res.errors).toHaveLength(0);
    expect(res.entries).toHaveLength(2);
    expect(res.orderRows).toBe(2);
    expect(res.entries[0]).toMatchObject({ orderSn: "260821UEFHR393", type: "ORDER", direction: "IN", amount: 40775 });
    // period dari metadata "Dari"/"Ke"
    expect(res.periodStart?.toISOString().slice(0, 10)).toBe("2026-07-26");
    expect(res.periodEnd?.toISOString().slice(0, 10)).toBe("2026-08-25");
  });

  it("Transaksi Keluar (Jumlah negatif) tetap diproses", () => {
    const buf = buildIncome([
      ["2026-08-25 21:54:20", "Penghasilan dari Pesanan", "x #A1", "A1", "Transaksi Masuk", 40775, "Transaksi Selesai", 1],
      ["2026-08-13 14:06:39", "Penarikan Dana", "Penarikan Dana", "-", "Transaksi Keluar", -10139555, "Transaksi Selesai", 2],
      ["2026-07-24 10:00:00", "Penghasilan dari Pesanan", "Potongan #A2", "A2", "Transaksi Keluar", -12900, "Transaksi Selesai", 3],
    ]);
    const res = parseIncomeReportFile(buf);
    expect(res.entries).toHaveLength(3);
    const keluar = res.entries.filter((e) => e.direction === "OUT");
    expect(keluar).toHaveLength(2);
    expect(keluar.every((e) => e.amount < 0)).toBe(true);
    // Penarikan Dana -> No. Pesanan "-" -> ADJUSTMENT
    const penarikan = res.entries.find((e) => e.adjustmentKind === "Penarikan Dana");
    expect(penarikan?.type).toBe("ADJUSTMENT");
    expect(penarikan?.orderSn).toBeNull();
    // Potongan ber-No.Pesanan -> tetap ORDER (nanti dijumlah di rekonsiliasi)
    const potongan = res.entries.find((e) => e.orderSn === "A2");
    expect(potongan?.type).toBe("ORDER");
    expect(potongan?.amount).toBe(-12900);
  });

  it("baris tanpa No. Pesanan -> Adjustment Shopee (tidak dipaksa match)", () => {
    const buf = buildIncome([
      ["2026-08-14 15:09:44", "Penyesuaian", "Pengembalian Pajak PPh 22", "-", "Transaksi Masuk", 3712, "Transaksi Selesai", 1],
      ["2026-08-25 21:54:20", "Penghasilan dari Pesanan", "x #A1", "A1", "Transaksi Masuk", 40775, "Transaksi Selesai", 2],
    ]);
    const res = parseIncomeReportFile(buf);
    expect(res.adjustmentRows).toBe(1);
    expect(res.orderRows).toBe(1);
    const adj = res.entries.find((e) => e.type === "ADJUSTMENT");
    expect(adj).toMatchObject({ orderSn: null, adjustmentKind: "Penyesuaian", amount: 3712 });
  });

  it("nominal string titik-ribuan di kolom Jumlah diparse benar", () => {
    const buf = buildIncome([
      ["2026-08-25 21:54:20", "Penghasilan dari Pesanan", "x #A1", "A1", "Transaksi Masuk", "1.361.250", "Transaksi Selesai", 1],
    ]);
    const res = parseIncomeReportFile(buf);
    expect(res.entries[0].amount).toBe(1361250);
  });

  it("skip baris ringkasan 'Total'", () => {
    const buf = buildIncome([
      ["2026-08-25 21:54:20", "Penghasilan dari Pesanan", "x #A1", "A1", "Transaksi Masuk", 40775, "Transaksi Selesai", 1],
      ["Total", "", "", "", "", 40775, "", ""],
    ]);
    const res = parseIncomeReportFile(buf);
    expect(res.entries).toHaveLength(1);
  });

  it("bukan file Transaction Report -> error spesifik menyebut header yang dicari", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Foo", "Bar", "Baz"], [1, 2, 3]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const res = parseIncomeReportFile(Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(res.entries).toHaveLength(0);
    expect(res.errors[0].message).toMatch(/Tanggal Transaksi/);
    expect(res.errors[0].message).toMatch(/No\. Pesanan/);
  });
});
