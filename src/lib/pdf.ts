import PDFDocument from "pdfkit";

export type PdfColumn = { header: string; width: number; align?: "left" | "right" };

export type PdfTableInput = {
  title: string;
  subtitle?: string;
  meta?: string[]; // baris info: periode, toko, dibuat pada
  columns: PdfColumn[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
};

const BRAND = "#ee4d2d";
const GREY = "#6b7280";
const LINE = "#e5e7eb";
const ZEBRA = "#f9fafb";

/** Bangun PDF berisi tabel detail per baris (multi-halaman, header kolom berulang). */
export function buildTablePdf(input: PdfTableInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const tableWidth = right - left;

  const totalWeight = input.columns.reduce((s, c) => s + c.width, 0);
  const colX: number[] = [];
  const colW: number[] = [];
  let acc = left;
  for (const c of input.columns) {
    const w = (c.width / totalWeight) * tableWidth;
    colX.push(acc);
    colW.push(w);
    acc += w;
  }

  const CELL_PAD = 4;
  const HEADER_H = 20;
  const FONT = 8;

  const drawColumnHeader = (y: number): number => {
    doc.rect(left, y, tableWidth, HEADER_H).fill(BRAND);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(FONT);
    input.columns.forEach((c, i) => {
      doc.text(c.header, colX[i] + CELL_PAD, y + 6, {
        width: colW[i] - CELL_PAD * 2,
        align: c.align ?? "left",
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.fillColor("#000000");
    return y + HEADER_H;
  };

  const rowHeight = (row: (string | number)[]): number => {
    doc.font("Helvetica").fontSize(FONT);
    let h = 12;
    input.columns.forEach((c, i) => {
      const txt = String(row[i] ?? "");
      const cellH = doc.heightOfString(txt, { width: colW[i] - CELL_PAD * 2 }) + CELL_PAD * 2;
      if (cellH > h) h = cellH;
    });
    return Math.max(14, h);
  };

  // ---- Judul ----
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(15).text(input.title, left, doc.page.margins.top);
  let y = doc.y + 2;
  if (input.subtitle) {
    doc.fillColor("#111827").font("Helvetica").fontSize(9).text(input.subtitle, left, y);
    y = doc.y + 1;
  }
  for (const m of input.meta ?? []) {
    doc.fillColor(GREY).font("Helvetica").fontSize(8).text(m, left, y);
    y = doc.y + 1;
  }
  y += 6;
  doc.fillColor("#000000");

  // ---- Tabel ----
  y = drawColumnHeader(y);
  input.rows.forEach((row, idx) => {
    const h = rowHeight(row);
    if (y + h > bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawColumnHeader(y);
    }
    if (idx % 2 === 1) doc.rect(left, y, tableWidth, h).fill(ZEBRA);
    doc.fillColor("#111827").font("Helvetica").fontSize(FONT);
    input.columns.forEach((c, i) => {
      doc.text(String(row[i] ?? ""), colX[i] + CELL_PAD, y + CELL_PAD, {
        width: colW[i] - CELL_PAD * 2,
        align: c.align ?? "left",
      });
    });
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(left, y + h).lineTo(right, y + h).stroke();
    y += h;
  });

  if (!input.rows.length) {
    doc.fillColor(GREY).font("Helvetica").fontSize(9).text("Tidak ada data pada filter ini.", left, y + 8);
    y = doc.y;
  }

  // ---- Ringkasan ----
  if (input.summary?.length) {
    if (y + 20 + input.summary.length * 14 > bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    y += 12;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text("Ringkasan", left, y);
    y = doc.y + 2;
    for (const s of input.summary) {
      doc.font("Helvetica").fontSize(8).fillColor("#111827");
      doc.text(s.label, left, y, { width: 220, continued: false });
      doc.text(s.value, left + 224, y, { width: 200, align: "left" });
      y = doc.y + 2;
    }
  }

  // ---- Footer nomor halaman ----
  const range = doc.bufferedPageRange();
  const stamp = `Dibuat ${new Date().toLocaleString("id-ID")}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const mb = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // cegah auto page-break saat menulis di area footer
    doc
      .fillColor(GREY)
      .font("Helvetica")
      .fontSize(7)
      .text(
        `${input.title}  -  ${stamp}  -  Hal. ${i - range.start + 1}/${range.count}`,
        left,
        doc.page.height - mb + 8,
        { width: tableWidth, align: "center", lineBreak: false }
      );
    doc.page.margins.bottom = mb;
  }

  doc.end();
  return done;
}
