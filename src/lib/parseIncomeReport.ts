import * as XLSX from "xlsx";

// Parser Income Report / Laporan Pendapatan (Rilis Dana) Shopee Seller Centre.
// Formatnya berbeda dari export Pesanan: header kadang tidak di baris 1 (ada blok
// judul/ringkasan di atas), dan ada baris tanpa "No. Pesanan" (kompensasi/sengketa/dsb).

export type IncomeParsedEntry = {
  orderSn: string | null;
  type: "ORDER" | "ADJUSTMENT";
  adjustmentKind: string | null;
  description: string | null;
  releasedAt: Date | null;
  amount: number;
  raw: Record<string, any>;
};

export type IncomeParseResult = {
  entries: IncomeParsedEntry[];
  orderRows: number;
  adjustmentRows: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  errors: { rowIndex: number; message: string }[];
  totalRows: number;
};

const norm = (s: any) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const ALIASES: Record<string, string[]> = {
  orderSn: ["no. pesanan", "no pesanan", "nomor pesanan", "order sn", "order id", "kode pesanan"],
  amount: [
    "total penghasilan",
    "total dana dilepaskan",
    "jumlah dana dilepaskan",
    "penghasilan yang diterima",
    "total dana dikeluarkan",
    "jumlah yang dirilis",
    "dana dilepaskan",
    "penghasilan",
    "amount",
  ],
  releasedAt: [
    "waktu dana dilepaskan",
    "tanggal dana dilepaskan",
    "tanggal pembayaran diselesaikan",
    "waktu pembayaran diselesaikan",
    "tanggal rilis dana",
  ],
  kind: ["tipe transaksi", "jenis transaksi", "jenis", "tipe", "kategori", "jenis penyesuaian"],
  description: ["deskripsi", "keterangan", "catatan", "nama produk"],
};

function toNumber(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  // buang pemisah ribuan & simbol, pertahankan minus & titik desimal
  let s = String(v).trim().replace(/[()]/g, "");
  const neg = /^-/.test(s) || /\(.*\)/.test(String(v));
  s = s.replace(/[^\d.,-]/g, "");
  // "1.234.567,89" -> "1234567.89" ; "1,234,567.89" -> "1234567.89"
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg && n > 0 ? -n : n;
}

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }
  const d = new Date(String(v).replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

/** Cari indeks baris yang berisi header (mengandung "No. Pesanan" ATAU kolom nilai). */
function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = (rows[i] || []).map(norm);
    const hasOrder = cells.some((c) => ALIASES.orderSn.includes(c));
    const hasAmount = cells.some((c) => ALIASES.amount.includes(c));
    if (hasOrder || hasAmount) return i;
  }
  return 0;
}

function mapHeaders(headerCells: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normed = headerCells.map(norm);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const idx = normed.findIndex((c) => aliases.includes(c));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

export function parseIncomeReportFile(buffer: Buffer): IncomeParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const errors: IncomeParseResult["errors"] = [];
  if (rows.length === 0) {
    return { entries: [], orderRows: 0, adjustmentRows: 0, periodStart: null, periodEnd: null, errors: [{ rowIndex: 0, message: "File kosong." }], totalRows: 0 };
  }

  const hIdx = findHeaderRow(rows);
  const headerCells = (rows[hIdx] || []).map((c) => String(c ?? ""));
  const map = mapHeaders(headerCells);

  if (map.amount == null) {
    return {
      entries: [],
      orderRows: 0,
      adjustmentRows: 0,
      periodStart: null,
      periodEnd: null,
      errors: [{ rowIndex: hIdx, message: `Kolom nilai penghasilan tidak ditemukan. Header terdeteksi: ${headerCells.join(" | ")}` }],
      totalRows: rows.length - hIdx - 1,
    };
  }

  const dataRows = rows.slice(hIdx + 1);
  const entries: IncomeParsedEntry[] = [];
  let orderRows = 0;
  let adjustmentRows = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  dataRows.forEach((r, i) => {
    if (!r || r.every((c) => String(c ?? "").trim() === "")) return; // baris kosong
    const firstCell = norm(r[0]);
    if (firstCell.startsWith("total") || firstCell.startsWith("grand total") || firstCell.startsWith("jumlah total")) return; // baris ringkasan

    try {
      const orderSnRaw = map.orderSn != null ? String(r[map.orderSn] ?? "").trim() : "";
      const orderSn = orderSnRaw && orderSnRaw !== "-" ? orderSnRaw : null;
      const amount = toNumber(r[map.amount]);
      const releasedAt = map.releasedAt != null ? toDateOrNull(r[map.releasedAt]) : null;
      const kind = map.kind != null ? String(r[map.kind] ?? "").trim() || null : null;
      const description = map.description != null ? String(r[map.description] ?? "").trim() || null : null;

      // Baris tanpa amount & tanpa order & tanpa kind -> skip (noise)
      if (!orderSn && amount === 0 && !kind && !description) return;

      const type: "ORDER" | "ADJUSTMENT" = orderSn ? "ORDER" : "ADJUSTMENT";
      if (type === "ORDER") orderRows++;
      else adjustmentRows++;

      if (releasedAt) {
        if (!minDate || releasedAt < minDate) minDate = releasedAt;
        if (!maxDate || releasedAt > maxDate) maxDate = releasedAt;
      }

      const rawObj: Record<string, any> = {};
      headerCells.forEach((h, ci) => {
        if (h) rawObj[h] = r[ci] ?? "";
      });

      entries.push({
        orderSn,
        type,
        adjustmentKind: type === "ADJUSTMENT" ? kind ?? description ?? "Adjustment" : null,
        description,
        releasedAt,
        amount,
        raw: rawObj,
      });
    } catch (e: any) {
      errors.push({ rowIndex: hIdx + 1 + i + 1, message: e?.message || "Gagal parsing baris." });
    }
  });

  return {
    entries,
    orderRows,
    adjustmentRows,
    periodStart: minDate,
    periodEnd: maxDate,
    errors,
    totalRows: dataRows.length,
  };
}
