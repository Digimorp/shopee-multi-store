import ExcelJS from "exceljs";

export type ExportColumn = { header: string; key: string; width?: number; kind?: "text" | "int" | "money" | "pct" };

/**
 * Bangun file .xlsx dari kolom + baris (nilai numerik tetap numerik agar bisa disum di Excel).
 * T-013 butir 14: `subtitle` (mis. "Periode Agustus 2026  -  2 toko", sama dengan PDF) -> baris 1
 * berisi subjudul, baris 2 kosong, header tabel di baris 3. Tanpa subtitle: header di baris 1
 * seperti sebelumnya. Kolom & nilai baris data tidak berubah, hanya bergeser ke bawah.
 */
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
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEC4899" } };

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
