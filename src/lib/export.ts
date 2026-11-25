import ExcelJS from "exceljs";

export type ExportColumn = { header: string; key: string; width?: number; kind?: "text" | "int" | "money" | "pct" };

/**
 * Bangun file .xlsx dari kolom + baris (nilai numerik tetap numerik agar bisa disum di Excel).
 * T-013 butir 14: `subtitle` (mis. "Periode 26 Jul - 25 Agu 2026  -  2 toko", sama dengan PDF) -> baris 1
 * berisi subjudul, baris 2 kosong, header tabel di baris 3. Tanpa subtitle: header di baris 1
 * seperti sebelumnya. Kolom & nilai baris data tidak berubah, hanya bergeser ke bawah.
 */
/** Warna header Excel (ARGB): brand-200 / brand-600 dari globals.css. */
export const XLSX_HEADER_FILL_ARGB = "FFE5E5E5";
export const XLSX_HEADER_FONT_ARGB = "FF0A0A0A";

export async function buildXlsx(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, any>[],
  summary?: { label: string; value: string }[],
  subtitle?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Laporan");

  // Key + lebar kolom saja; header ditulis manual supaya bisa diletakkan di bawah subjudul.
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));
  if (subtitle) {
    ws.addRow([subtitle]).font = { bold: true };
    ws.addRow([]);
  }
  const header = ws.addRow(columns.map((c) => c.header));
  // T-013 batch 11: header netral selaras monokrom -- latar brand-200 (#e5e5e5), teks brand-600
  // (#0a0a0a), nilai dari src/app/globals.css. Dulu pink.
  header.font = { bold: true, color: { argb: XLSX_HEADER_FONT_ARGB } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_HEADER_FILL_ARGB } };

  for (const r of rows) ws.addRow(r);

  // Format angka kolom uang / persen
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.kind === "money") col.numFmt = '#,##0';
    else if (c.kind === "pct") col.numFmt = '0.0%';
  });

  if (summary?.length) {
    ws.addRow([]);
    ws.addRow(["RINGKASAN"]).font = { bold: true };
    for (const s of summary) ws.addRow([s.label, s.value]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
