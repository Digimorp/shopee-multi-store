import * as XLSX from "xlsx";
import { parseIdNumber } from "@/lib/parseNumber";

// Parser Income Report / Laporan Saldo Shopee — sheet "Transaction Report".
// Struktur file resmi:
//   Baris 1..17  : metadata (Laporan, Info Rekening, Username Penjual, Dari/Ke,
//                  Ringkasan Total Saldo Masuk/Keluar) — DILEWATI.
//   Baris ~18    : header transaksi:
//     Tanggal Transaksi | Tipe Transaksi | Deskripsi | No. Pesanan |
//     Jenis Transaksi | Jumlah | Status | Saldo Akhir
//   Baris data   : "Jenis Transaksi" = "Transaksi Masuk" (uang cair, Jumlah +) atau
//                  "Transaksi Keluar" (biaya/penarikan/refund, Jumlah -). KEDUANYA diproses.
//   "No. Pesanan" = key rekonsiliasi ke file Pesanan. Kosong / "-" (mis. Penarikan Dana,
//                  Penyesuaian pajak) -> dikategorikan "Adjustment Shopee", tidak dipaksa match.

export type IncomeParsedEntry = {
  orderSn: string | null;
  type: "ORDER" | "ADJUSTMENT";
  direction: "IN" | "OUT"; // Transaksi Masuk / Keluar
  adjustmentKind: string | null;
  description: string | null;
  releasedAt: Date | null;
  amount: number; // Jumlah — negatif untuk Transaksi Keluar
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
  date: ["tanggal transaksi", "waktu transaksi", "tanggal", "waktu dana dilepaskan", "tanggal dana dilepaskan"],
  tipe: ["tipe transaksi", "jenis penyesuaian", "tipe"],
  description: ["deskripsi", "keterangan", "catatan"],
  orderSn: ["no. pesanan", "no pesanan", "nomor pesanan", "order sn", "order id", "kode pesanan"],
  direction: ["jenis transaksi", "arah transaksi", "jenis"],
  amount: [
    "jumlah",
    "total penghasilan",
    "total dana dilepaskan",
    "jumlah dana dilepaskan",
    "penghasilan yang diterima",
    "nilai",
    "amount",
  ],
  status: ["status", "status transaksi"],
};

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }
  const d = new Date(String(v).trim().replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Cari indeks baris header secara dinamis. Utama: baris yang mengandung
 * "Tanggal Transaksi" DAN "No. Pesanan". Cadangan: baris yang punya kolom
 * No. Pesanan + kolom nilai. Return -1 kalau tak ketemu.
 */
function findHeaderRow(rows: any[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(norm);
    if (cells.some((c) => ALIASES.date.includes(c)) && cells.some((c) => ALIASES.orderSn.includes(c))) return i;
  }
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(norm);
    if (cells.some((c) => ALIASES.orderSn.includes(c)) && cells.some((c) => ALIASES.amount.includes(c))) return i;
  }
  return -1;
}

function mapHeaders(headerCells: string[]): Record<string, number> {
  const normed = headerCells.map(norm);
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const idx = normed.indexOf(alias);
      if (idx >= 0) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

/** Baca "Dari" / "Ke" dari blok metadata (baris sebelum header). */
function readMetaPeriod(rows: any[][], headerIdx: number): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;
  for (let i = 0; i < headerIdx; i++) {
    const row = rows[i] || [];
    for (let c = 0; c < row.length - 1; c++) {
      const label = norm(row[c]);
      if (label === "dari" || label === "from") start = toDateOrNull(row[c + 1]) ?? start;
      if (label === "ke" || label === "sampai" || label === "to") end = toDateOrNull(row[c + 1]) ?? end;
    }
  }
  return { start, end };
}

function pickSheet(wb: XLSX.WorkBook): string {
  const hit = wb.SheetNames.find((n) => /transaction report|laporan|saldo|income|pendapatan|balance/i.test(n));
  return hit ?? wb.SheetNames[0];
}

export function parseIncomeReportFile(buffer: Buffer): IncomeParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = pickSheet(wb);
  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const empty = (msg: string, at = 0, total = 0): IncomeParseResult => ({
    entries: [],
    orderRows: 0,
    adjustmentRows: 0,
    periodStart: null,
    periodEnd: null,
    errors: [{ rowIndex: at, message: msg }],
    totalRows: total,
  });

  if (rows.length === 0) return empty(`Sheet "${sheetName}" kosong.`);

  const hIdx = findHeaderRow(rows);
  if (hIdx < 0) {
    const preview = rows
      .slice(0, 20)
      .map((r, i) => `  baris ${i + 1}: [${(r || []).map((c) => String(c ?? "")).join(" | ")}]`)
      .join("\n");
    return empty(
      `Tidak menemukan baris header Income Report. Parser mencari baris yang berisi kolom ` +
        `"Tanggal Transaksi" + "No. Pesanan". Pastikan ini file "Laporan Saldo / Transaction Report" ` +
        `dari Shopee (Keuangan > Saldo Penghasilan > Ekspor).\n20 baris pertama:\n${preview}`,
      0,
      rows.length
    );
  }

  const headerCells = (rows[hIdx] || []).map((c) => String(c ?? ""));
  const map = mapHeaders(headerCells);

  const missing: string[] = [];
  if (map.orderSn == null) missing.push('"No. Pesanan"');
  if (map.amount == null) missing.push('"Jumlah"');
  if (map.date == null) missing.push('"Tanggal Transaksi"');
  if (missing.length) {
    return empty(
      `Header Income Report ditemukan di baris ${hIdx + 1} tapi kolom berikut tidak ada: ${missing.join(", ")}. ` +
        `Header yang terbaca: [${headerCells.join(" | ")}].`,
      hIdx,
      rows.length - hIdx - 1
    );
  }

  const meta = readMetaPeriod(rows, hIdx);
  const dataRows = rows.slice(hIdx + 1);
  const entries: IncomeParsedEntry[] = [];
  let orderRows = 0;
  let adjustmentRows = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  const errors: IncomeParseResult["errors"] = [];

  dataRows.forEach((r, i) => {
    if (!r || r.every((c) => String(c ?? "").trim() === "")) return;
    const firstCell = norm(r[0]);
    if (firstCell.startsWith("total ") || firstCell === "total" || firstCell.startsWith("grand total")) return;

    try {
      const snRaw = String(r[map.orderSn] ?? "").trim();
      const orderSn = snRaw && snRaw !== "-" ? snRaw : null;
      const amount = parseIdNumber(r[map.amount]);
      const releasedAt = map.date != null ? toDateOrNull(r[map.date]) : null;
      const tipe = map.tipe != null ? String(r[map.tipe] ?? "").trim() || null : null;
      const description = map.description != null ? String(r[map.description] ?? "").trim() || null : null;
      const dirRaw = map.direction != null ? norm(r[map.direction]) : "";
      const direction: "IN" | "OUT" = dirRaw.includes("keluar") || amount < 0 ? "OUT" : "IN";

      // Baris betul-betul kosong info -> lewati.
      if (!orderSn && amount === 0 && !tipe && !description) return;

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
        direction,
        adjustmentKind: type === "ADJUSTMENT" ? tipe ?? description ?? "Adjustment" : null,
        description,
        releasedAt,
        amount,
        raw: rawObj,
      });
    } catch (e: any) {
      errors.push({ rowIndex: hIdx + 2 + i, message: e?.message || "Gagal parsing baris." });
    }
  });

  if (entries.length === 0) {
    return empty(
      `Header terbaca di baris ${hIdx + 1} tapi tidak ada baris transaksi valid di bawahnya.`,
      hIdx,
      dataRows.length
    );
  }

  return {
    entries,
    orderRows,
    adjustmentRows,
    periodStart: meta.start ?? minDate,
    periodEnd: meta.end ?? maxDate,
    errors,
    totalRows: dataRows.length,
  };
}
