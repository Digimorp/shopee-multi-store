import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportColumn = { header: string; key: string; width?: number };

export async function buildXlsx(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, any>[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEE4D2D" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildSimplePdf(title: string, lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  page.drawText(title, { x: 40, y, size: 16, font: bold, color: rgb(0.93, 0.3, 0.18) });
  y -= 30;

  for (const line of lines) {
    if (y < 40) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
