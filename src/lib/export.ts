import ExcelJS from "exceljs";

export type ExportColumn = { header: string; key: string; width?: number; kind?: "text" | "int" | "money" | "pct" };

/** Bangun file .xlsx dari kolom + baris (nilai numerik tetap numerik agar bisa disum di Excel). */
export async function buildXlsx(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, any>[],
  summary?: { label: string; value: string }[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Laporan");

  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEE4D2D" } };

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
