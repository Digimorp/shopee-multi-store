import * as XLSX from "xlsx";
import { parseIdNumber } from "@/lib/parseNumber";

export type ParsedRow = {
  orderSn: string;
  sku: string; // Nomor Referensi SKU (fallback: SKU Induk)
  skuInduk: string; // SKU Induk — dipakai sebagai fallback matching HPP
  productName: string;
  variationName: string; // Nama Variasi (fallback matching HPP kalau SKU kosong)
  qty: number;
  returnedQty: number;
  unitPrice: number; // Harga Setelah Diskon (fallback: Harga Awal)
  subtotal: number; // Subtotal Pesanan (nilai baris ini)
  totalPayment: number; // Total Pembayaran (nilai pesanan; berulang di tiap baris utk multi-item)
  netSettlementRaw: number; // estimasi uang cair — dari file kalau ada, else Subtotal
  adminFee: number;
  rawStatus: string; // teks "Status Pesanan" apa adanya — diklasifikasi di upload route
  settlementColumnPresent: boolean; // file punya kolom "Waktu Dana Dilepaskan"?
  hasSettlementDate: boolean; // kolom itu terisi? -> pembeda SELESAI vs PENDING (format lama)
  orderCreatedAt: Date;
  completedAt: Date | null; // "Waktu Pesanan Selesai" (opsional)
  settlementDate: Date | null; // "Waktu Dana Dilepaskan" (opsional, format lama)
  raw: Record<string, any>;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: { rowIndex: number; message: string }[];
  totalRows: number;
};

// Alias header — urutan = prioritas (yang pertama cocok dipakai).
// Skema resmi export Pesanan Shopee (Order.all.[periode].xlsx, sheet "orders", 50 kolom).
const HEADER_ALIASES: Record<string, string[]> = {
  orderSn: ["no. pesanan", "no pesanan", "nomor pesanan", "order id", "order sn"],
  status: ["status pesanan", "status"],
  skuRef: ["nomor referensi sku", "sku reference no.", "reference sku"],
  skuInduk: ["sku induk", "parent sku"],
  productName: ["nama produk", "product name"],
  variationName: ["nama variasi", "variation name"],
  qty: ["jumlah", "quantity", "qty"],
  returnedQty: ["returned quantity", "jumlah dikembalikan"],
  unitPrice: ["harga setelah diskon", "deal price", "harga awal", "original price", "harga satuan"],
  subtotal: ["subtotal pesanan", "order subtotal", "subtotal produk"],
  totalPayment: ["total pembayaran", "total amount", "grand total"],
  // Kolom berikut TIDAK ada di skema resmi baru — dipertahankan utk kompatibilitas file lama.
  netSettlement: ["total penghasilan", "total diterima", "penghasilan"],
  adminFee: ["biaya administrasi", "biaya layanan", "biaya admin", "commission fee"],
  orderCreatedAt: ["waktu pesanan dibuat", "order creation date", "tanggal pesanan"],
  paymentDoneAt: ["waktu pembayaran dilakukan", "order paid time"],
  settlementDate: ["waktu dana dilepaskan", "tanggal dana dilepaskan", "fund release date"],
  completedAt: ["waktu pesanan selesai", "order complete time", "waktu selesai"],
};

// Nama kolom "resmi" untuk pesan error yang informatif.
const FIELD_LABEL: Record<string, string> = {
  orderSn: "No. Pesanan",
  status: "Status Pesanan",
  productName: "Nama Produk",
  qty: "Jumlah",
  orderCreatedAt: "Waktu Pesanan Dibuat",
};

const REQUIRED_FIELDS = ["orderSn", "status", "productName", "qty", "orderCreatedAt"];

function normalizeHeader(h: string) {
  return String(h).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Petakan field -> nama header asli di file, hormati urutan alias sebagai prioritas. */
function buildHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx >= 0) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

function toDate(v: any): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }
  const parsed = new Date(String(v).trim().replace(/\//g, "-"));
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const d = toDate(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Pilih sheet "orders"/"pesanan" kalau ada, else sheet pertama. */
function pickSheet(wb: XLSX.WorkBook): string {
  const hit = wb.SheetNames.find((n) => /order|pesanan/i.test(n));
  return hit ?? wb.SheetNames[0];
}

export function parseShopeeFile(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = pickSheet(wb);
  const sheet = wb.Sheets[sheetName];
  const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const errors: ParseResult["errors"] = [];
  const rows: ParsedRow[] = [];

  if (json.length === 0) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, message: `Sheet "${sheetName}" kosong / tidak ada baris data di bawah header.` }],
      totalRows: 0,
    };
  }

  const headers = Object.keys(json[0]);
  const map = buildHeaderMap(headers);

  const missing = REQUIRED_FIELDS.filter((f) => !map[f]);
  if (missing.length > 0) {
    const wanted = missing.map((f) => `"${FIELD_LABEL[f] ?? f}"`).join(", ");
    errors.push({
      rowIndex: 1,
      message:
        `Kolom wajib tidak ditemukan di file Pesanan: ${wanted}. ` +
        `Header yang terbaca di baris 1: [${headers.join(" | ")}]. ` +
        `Pastikan file adalah export "Pesanan" Shopee (sheet "orders") dengan baris header di baris 1.`,
    });
    return { rows: [], errors, totalRows: json.length };
  }

  const settlementColumnPresent = !!map.settlementDate;

  json.forEach((row, idx) => {
    try {
      const orderSn = String(row[map.orderSn] ?? "").trim();
      if (!orderSn) return; // baris tanpa No. Pesanan (mis. baris ringkasan) -> lewati diam-diam

      const settlementRaw = map.settlementDate ? row[map.settlementDate] : "";
      const hasSettlementDate = !!settlementRaw && String(settlementRaw).trim() !== "";

      const qty = Math.max(1, Math.round(parseIdNumber(row[map.qty])));
      const returnedQty = map.returnedQty ? Math.max(0, Math.round(parseIdNumber(row[map.returnedQty]))) : 0;
      const unitPrice = parseIdNumber(row[map.unitPrice]);
      const subtotal = map.subtotal ? parseIdNumber(row[map.subtotal]) : unitPrice * qty;
      const totalPayment = map.totalPayment ? parseIdNumber(row[map.totalPayment]) : subtotal;

      // Estimasi uang cair: kalau file punya kolom penghasilan (format lama) pakai itu;
      // kalau tidak (skema resmi baru) pakai Subtotal Pesanan sebagai estimasi kasar —
      // angka AKTUAL nanti datang dari Income Report lewat modul Rekonsiliasi.
      const netSettlementRaw = map.netSettlement
        ? parseIdNumber(row[map.netSettlement])
        : subtotal || totalPayment || unitPrice * qty;

      const adminFee = map.adminFee
        ? parseIdNumber(row[map.adminFee])
        : Math.max(0, totalPayment - netSettlementRaw);

      const skuRef = String(row[map.skuRef] ?? "").trim();
      const skuInduk = String(row[map.skuInduk] ?? "").trim();

      const orderCreatedAt =
        toDateOrNull(row[map.orderCreatedAt]) ??
        (map.paymentDoneAt ? toDateOrNull(row[map.paymentDoneAt]) : null) ??
        new Date();

      rows.push({
        orderSn,
        sku: skuRef || skuInduk,
        skuInduk,
        productName: String(row[map.productName] ?? "").trim(),
        variationName: String(row[map.variationName] ?? "").trim(),
        qty,
        returnedQty,
        unitPrice,
        subtotal,
        totalPayment,
        netSettlementRaw,
        adminFee,
        rawStatus: String(row[map.status] ?? "").trim(),
        settlementColumnPresent,
        hasSettlementDate,
        orderCreatedAt,
        completedAt: map.completedAt ? toDateOrNull(row[map.completedAt]) : null,
        settlementDate: map.settlementDate ? toDateOrNull(row[map.settlementDate]) : null,
        raw: row,
      });
    } catch (e: any) {
      errors.push({ rowIndex: idx + 2, message: e?.message || "Gagal parsing baris." });
    }
  });

  return { rows, errors, totalRows: json.length };
}
