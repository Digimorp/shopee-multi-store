import * as XLSX from "xlsx";

/**
 * T-013 batch 15 (bagian A): deteksi jenis file upload dari STRUKTUR-nya (bukan nama file).
 * - Laporan Pesanan (Order.all / On Proses Shopee): satu baris header berisi "No. Pesanan" +
 *   "Status Pesanan" + "Waktu Pesanan Dibuat" -> diproses /api/upload.
 * - Income Report (Saldo Penghasilan / Transaction Report): ada sheet "Transaction Report", atau baris
 *   header berisi "Jumlah" + ("Saldo Akhir" / "Tipe Transaksi" / "Tanggal Transaksi") -> /api/income/import.
 * - Tidak cocok keduanya / kosong -> null + pesan jelas; file TIDAK diproses.
 * Hanya membaca maksimal 40 baris pertama tiap sheet (cepat, di browser).
 */
export type UploadKind = "pesanan" | "income";
export type DetectResult = { kind: UploadKind | null; message: string };

export const UPLOAD_KIND_LABEL: Record<UploadKind, string> = {
  pesanan: "Laporan Pesanan",
  income: "Income Report",
};

const SCAN_ROWS = 40;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const ORDER_SN = ["no. pesanan", "no pesanan", "nomor pesanan", "order id", "order sn"];
const ORDER_STATUS = ["status pesanan", "order status"];
const ORDER_CREATED = ["waktu pesanan dibuat", "order creation date", "tanggal pesanan"];
const INCOME_AMOUNT = ["jumlah", "amount"];
const INCOME_MARKERS = ["saldo akhir", "tipe transaksi", "tanggal transaksi", "jenis transaksi"];

const hasAny = (cells: string[], list: string[]) => cells.some((c) => list.includes(c));

export function detectFromSheets(sheets: { name: string; rows: unknown[][] }[]): DetectResult {
  const nonEmpty = sheets.filter((s) => s.rows.some((r) => (r ?? []).some((c) => norm(c) !== "")));
  if (nonEmpty.length === 0) return { kind: null, message: "File kosong: tidak ada baris data." };

  for (const s of nonEmpty) {
    for (const row of s.rows.slice(0, SCAN_ROWS)) {
      const cells = (row ?? []).map(norm);
      if (hasAny(cells, ORDER_SN) && hasAny(cells, ORDER_STATUS) && hasAny(cells, ORDER_CREATED)) {
        return { kind: "pesanan", message: `Terdeteksi: ${UPLOAD_KIND_LABEL.pesanan}` };
      }
    }
  }
  for (const s of nonEmpty) {
    if (norm(s.name) === "transaction report") return { kind: "income", message: `Terdeteksi: ${UPLOAD_KIND_LABEL.income}` };
    for (const row of s.rows.slice(0, SCAN_ROWS)) {
      const cells = (row ?? []).map(norm);
      if (hasAny(cells, INCOME_AMOUNT) && hasAny(cells, INCOME_MARKERS)) {
        return { kind: "income", message: `Terdeteksi: ${UPLOAD_KIND_LABEL.income}` };
      }
    }
  }
  return {
    kind: null,
    message:
      'Format tidak dikenali. Laporan Pesanan harus punya kolom "No. Pesanan", "Status Pesanan", "Waktu Pesanan Dibuat"; ' +
      'Income Report harus punya kolom "Jumlah" dan "Saldo Akhir"/"Tipe Transaksi". File ini tidak diproses.',
  };
}

/** Baca file (xlsx/xls/csv) lalu deteksi. File rusak/tidak terbaca -> kind null. */
export function detectFromBuffer(buf: ArrayBuffer | Uint8Array): DetectResult {
  try {
    const wb = XLSX.read(buf, { type: "array", sheetRows: SCAN_ROWS });
    const sheets = wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }),
    }));
    return detectFromSheets(sheets);
  } catch {
    return { kind: null, message: "File tidak bisa dibaca (bukan .xlsx/.xls/.csv yang valid). File ini tidak diproses." };
  }
}
