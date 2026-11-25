import { getPeriodMonthForDate } from "@/lib/period";
import { formatRupiah } from "@/lib/format";

/**
 * T-013 batch 13 (tugas X) -- "Uang Cair periode" = TOTAL SALDO MASUK di Income Report untuk
 * rentang periode (keputusan Founder; sama dengan "Total Saldo Masuk" di file Shopee).
 * File ini MURNI (tanpa Prisma, aman untuk client). Pengambilan data: src/lib/uangCairPeriodeDb.ts.
 *
 * - Tanggal entri = releasedAt (Tanggal Dana Dilepaskan), fallback tanggal import.
 * - total = jumlah entri MASUK (amount > 0) yang tanggalnya di dalam periode (cut-off WIB).
 * - Entri KELUAR (amount < 0) tidak ikut total; dicatat terpisah di saldoKeluar (nilai positif).
 * - Rincian (a)+(b)+(c) = total, persis:
 *   (a) pesananPeriodeIni = entri berpesanan yang pesanannya ADA di database dan dibuat di periode ini;
 *   (b) pesananLain       = entri berpesanan lain (pesanan periode lain, atau belum diunggah);
 *   (c) penyesuaian       = entri non-pesanan (Penyesuaian, Kompensasi, dll).
 * Profit HPP/Agen dan kolom per SKU/produk/toko TIDAK memakai angka ini -- tetap dari uang cair
 * pesanan periode ini (reconcile + allocateActual), karena (b)/(c) tidak bisa dialokasikan ke produk.
 */
export type UangCairEntry = {
  storeId: string;
  type: string; // "ORDER" | "ADJUSTMENT"
  orderSn: string | null;
  amount: number;
  releasedAt: Date | null;
  importCreatedAt: Date;
};

export type UangCairRincian = {
  total: number;
  pesananPeriodeIni: number;
  pesananLain: number;
  penyesuaian: number;
  /** total transaksi keluar (positif) di periode -- TIDAK ikut total */
  saldoKeluar: number;
  /** jumlah entri masuk yang dihitung */
  jumlahEntri: number;
  /** entri masuk yang tanggalnya diambil dari tanggal import (releasedAt kosong) */
  fallbackImport: number;
};

export const emptyRincian = (): UangCairRincian => ({
  total: 0,
  pesananPeriodeIni: 0,
  pesananLain: 0,
  penyesuaian: 0,
  saldoKeluar: 0,
  jumlahEntri: 0,
  fallbackImport: 0,
});

export const entryDate = (e: Pick<UangCairEntry, "releasedAt" | "importCreatedAt">): Date =>
  e.releasedAt ?? e.importCreatedAt;

/** Tambah satu entri (yang sudah pasti di dalam periode) ke rincian. */
function addEntry(r: UangCairRincian, e: UangCairEntry, orderInThisPeriod: boolean) {
  if (!(e.amount > 0)) {
    if (e.amount < 0) r.saldoKeluar += -e.amount;
    return;
  }
  r.jumlahEntri++;
  if (!e.releasedAt) r.fallbackImport++;
  if (e.type === "ORDER" && e.orderSn) {
    if (orderInThisPeriod) r.pesananPeriodeIni += e.amount;
    else r.pesananLain += e.amount;
  } else {
    r.penyesuaian += e.amount;
  }
  // total selalu = (a)+(b)+(c), dihitung dari rinciannya (tanpa beda pembulatan).
  r.total = r.pesananPeriodeIni + r.pesananLain + r.penyesuaian;
}

/**
 * Rincian satu rentang periode [from, to]. `orderCreatedAtBySn` = No. Pesanan -> tanggal pesanan
 * dibuat (hanya pesanan yang ada di database, tidak di-soft-delete, toko yang difilter).
 */
export function summarizeUangCair(
  entries: UangCairEntry[],
  from: Date,
  to: Date,
  orderCreatedAtBySn: Map<string, Date>
): { all: UangCairRincian; byStore: Record<string, UangCairRincian> } {
  const all = emptyRincian();
  const byStore: Record<string, UangCairRincian> = {};
  const inRange = (d: Date) => d >= from && d <= to;
  for (const e of entries) {
    if (!inRange(entryDate(e))) continue;
    const created = e.orderSn ? orderCreatedAtBySn.get(e.orderSn) : undefined;
    const orderInThisPeriod = !!created && inRange(created);
    addEntry(all, e, orderInThisPeriod);
    addEntry((byStore[e.storeId] ??= emptyRincian()), e, orderInThisPeriod);
  }
  return { all, byStore };
}

/** Rincian per bulan periode cut-off ("YYYY-MM", WIB) -- untuk Rekap Bulanan/Tahunan. */
export function summarizeUangCairPerBulan(
  entries: UangCairEntry[],
  orderCreatedAtBySn: Map<string, Date>,
  cutoffDay: number
): Map<string, UangCairRincian> {
  const out = new Map<string, UangCairRincian>();
  for (const e of entries) {
    const month = getPeriodMonthForDate(entryDate(e), cutoffDay);
    const created = e.orderSn ? orderCreatedAtBySn.get(e.orderSn) : undefined;
    const orderInThisPeriod = !!created && getPeriodMonthForDate(created, cutoffDay) === month;
    let r = out.get(month);
    if (!r) out.set(month, (r = emptyRincian()));
    addEntry(r, e, orderInThisPeriod);
  }
  return out;
}

/** Angka yang dikirim ke klien (tanpa byStore / hitungan entri). */
export function pickRincian(r: UangCairRincian) {
  return {
    total: r.total,
    pesananPeriodeIni: r.pesananPeriodeIni,
    pesananLain: r.pesananLain,
    penyesuaian: r.penyesuaian,
    saldoKeluar: r.saldoKeluar,
  };
}
export type RincianUangCairJson = ReturnType<typeof pickRincian>;

/** Jumlahkan beberapa rincian (mis. 12 bulan -> tahunan). */
export function sumRincian(list: UangCairRincian[]): UangCairRincian {
  const r = emptyRincian();
  for (const x of list) {
    r.pesananPeriodeIni += x.pesananPeriodeIni;
    r.pesananLain += x.pesananLain;
    r.penyesuaian += x.penyesuaian;
    r.saldoKeluar += x.saldoKeluar;
    r.jumlahEntri += x.jumlahEntri;
    r.fallbackImport += x.fallbackImport;
  }
  r.total = r.pesananPeriodeIni + r.pesananLain + r.penyesuaian;
  return r;
}

export const UANG_CAIR_LABEL = "Uang Cair (semua saldo masuk periode ini)";
export const UANG_CAIR_PESANAN_LABEL = "Uang Cair Pesanan Periode Ini";
export const PROFIT_BASIS_NOTE = "Profit dihitung dari uang cair pesanan periode ini.";

/** Satu baris rincian (a)/(b)/(c) untuk kartu & export. */
export function formatRincianUangCair(r: Pick<UangCairRincian, "pesananPeriodeIni" | "pesananLain" | "penyesuaian">): string {
  return (
    `Pesanan periode ini ${formatRupiah(r.pesananPeriodeIni)} + ` +
    `pesanan periode lain/belum diunggah ${formatRupiah(r.pesananLain)} + ` +
    `penyesuaian ${formatRupiah(r.penyesuaian)}`
  );
}

/** Teks kecil di bawah kartu: rincian (a)/(b)/(c) + saldo keluar (hanya bila > 0). Tanpa data -> undefined. */
export function rincianUangCairSub(r: RincianUangCairJson | null | undefined): string | undefined {
  if (!r) return undefined;
  const keluar = formatSaldoKeluar(r);
  return keluar ? `${formatRincianUangCair(r)}. ${keluar}` : formatRincianUangCair(r);
}

/** Catatan kecil saldo keluar -- null kalau 0 (tidak ditampilkan). */
export function formatSaldoKeluar(r: Pick<UangCairRincian, "saldoKeluar"> | null | undefined): string | null {
  return r && r.saldoKeluar > 0 ? `Saldo keluar: ${formatRupiah(r.saldoKeluar)}` : null;
}
