import * as XLSX from "xlsx";

export type ParsedRow = {
  orderSn: string;
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalPayment: number; // omzet bruto dari file (sebelum penyesuaian status)
  netSettlementRaw: number; // penghasilan dari file (sebelum penyesuaian status)
  adminFee: number;
  rawStatus: string; // teks "Status Pesanan" apa adanya — diklasifikasi di upload route
  hasSettlementDate: boolean; // "Waktu Dana Dilepaskan" terisi? -> pembeda SELESAI vs PENDING
  orderCreatedAt: Date;
  completedAt: Date | null; // "Waktu Pesanan Selesai" (opsional)
  settlementDate: Date | null; // "Waktu Dana Dilepaskan" (opsional, versi estimasi Shopee)
  raw: Record<string, any>;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: { rowIndex: number; message: string }[];
  totalRows: number;
};

// Alias header kolom export Shopee Seller Centre (Indonesia). Tambahkan alias baru
// di sini kalau format export toko kamu beda penamaan kolomnya.
const HEADER_ALIASES: Record<string, string[]> = {
  orderSn: ["no. pesanan", "no pesanan", "order id", "nomor pesanan"],
  status: ["status pesanan", "status"],
  sku: ["nomor referensi sku", "sku induk", "sku", "kode sku"],
  productName: ["nama produk", "product name"],
  qty: ["jumlah", "qty", "jumlah produk dibeli"],
  unitPrice: ["harga setelah diskon", "harga satuan", "harga awal"],
  totalPayment: ["total pembayaran", "total harga produk"],
  netSettlement: ["total penghasilan", "total diterima", "jumlah yang harus dibayarkan pembeli"],
  adminFee: ["biaya administrasi", "biaya layanan", "biaya admin"],
  orderCreatedAt: ["waktu pesanan dibuat", "tanggal pesanan", "waktu pembuatan pesanan"],
  settlementDate: ["waktu dana dilepaskan", "tanggal dana dilepaskan"],
  completedAt: ["waktu pesanan selesai", "tanggal pesanan selesai", "waktu selesai"],
};

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const d = toDate(v);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeHeader(h: string) {
  return String(h).trim().toLowerCase();
}

function buildHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field] = headers[idx];
  }
  return map;
}

function toNumber(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function toDate(v: any): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Serial date Excel
    const d = XLSX.SSF.parse_date_code(v);
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

export function parseShopeeFile(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const errors: ParseResult["errors"] = [];
  const rows: ParsedRow[] = [];

  if (json.length === 0) {
    return { rows: [], errors: [{ rowIndex: 0, message: "File kosong atau format tidak terbaca." }], totalRows: 0 };
  }

  const headers = Object.keys(json[0]);
  const map = buildHeaderMap(headers);

  const required = ["orderSn", "status", "sku", "productName", "qty", "orderCreatedAt"];
  const missing = required.filter((f) => !map[f]);
  if (missing.length > 0) {
    errors.push({
      rowIndex: 0,
      message: `Kolom wajib tidak ditemukan di file: ${missing.join(", ")}. Cek header file export Shopee kamu.`,
    });
    return { rows: [], errors, totalRows: json.length };
  }

  json.forEach((row, idx) => {
    try {
      const settlementRaw = map.settlementDate ? row[map.settlementDate] : "";
      const hasSettlementDate = !!settlementRaw && String(settlementRaw).trim() !== "";

      const qty = Math.max(1, Math.round(toNumber(row[map.qty])));
      const unitPrice = toNumber(row[map.unitPrice]);
      const totalPayment = map.totalPayment ? toNumber(row[map.totalPayment]) : unitPrice * qty;
      const netSettlementRaw = map.netSettlement ? toNumber(row[map.netSettlement]) : totalPayment;
      const adminFee = map.adminFee ? toNumber(row[map.adminFee]) : Math.max(0, totalPayment - netSettlementRaw);

      rows.push({
        orderSn: String(row[map.orderSn] ?? "").trim(),
        sku: String(row[map.sku] ?? "").trim(),
        productName: String(row[map.productName] ?? "").trim(),
        qty,
        unitPrice,
        totalPayment,
        netSettlementRaw,
        adminFee,
        rawStatus: String(row[map.status] ?? "").trim(),
        hasSettlementDate,
        orderCreatedAt: toDate(row[map.orderCreatedAt]),
        completedAt: map.completedAt ? toDateOrNull(row[map.completedAt]) : null,
        settlementDate: map.settlementDate ? toDateOrNull(row[map.settlementDate]) : null,
        raw: row,
      });
    } catch (e: any) {
      errors.push({ rowIndex: idx + 2, message: e.message || "Gagal parsing baris." });
    }
  });

  return { rows, errors, totalRows: json.length };
}
