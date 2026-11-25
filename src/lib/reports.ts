import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPeriodLabel, parsePeriodKey } from "@/lib/period";
import {
  productGroupKey,
  emptyTally,
  addProfitLine,
  emptyAgenTally,
  addAgenLine,
  lineProfitAgen,
  type ProfitTally,
  type AgenTally,
} from "@/lib/profit";
import { reconcile, buildActualLookup, allocateActual } from "@/lib/reconciliation";
import { returLoss, sumReturLoss } from "@/lib/returLoss";
import { buildRecap } from "@/lib/recap";
import { shownProfitHpp, shownProfitAgen, shownSelisih } from "@/lib/hppDisplay";
import { getUangCairPeriode, getUangCairPerBulan } from "@/lib/uangCairPeriodeDb";
import {
  UANG_CAIR_LABEL,
  UANG_CAIR_PESANAN_LABEL,
  PROFIT_BASIS_NOTE,
  formatRincianUangCair,
  formatSaldoKeluar,
} from "@/lib/uangCairPeriode";

export type ColKind = "text" | "int" | "money" | "pct";
export type ReportColumn = { key: string; header: string; width: number; align?: "left" | "right"; kind?: ColKind };
export type ReportDataset = {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: { label: string; value: string }[];
};

export type ReportFilter = { storeIds: string[]; from: Date; to: Date };

// T-013: baris tanpa HPP (hppSnapshot = 0) tidak dihitung ke profit -- dijumlah terpisah.
type TanpaHpp = ProfitTally["tanpaHpp"];
function sumTanpaHpp(list: { tanpaHpp: TanpaHpp }[]): TanpaHpp {
  return {
    baris: list.reduce((s, r) => s + r.tanpaHpp.baris, 0),
    uangCair: list.reduce((s, r) => s + r.tanpaHpp.uangCair, 0),
  };
}
const TANPA_HPP_LABEL = "Tanpa HPP (tidak dihitung ke profit)";
function tanpaHppValue(t: TanpaHpp): string {
  return int(t.baris) + " baris, " + rupiah(t.uangCair);
}

const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const int = (n: number) => Math.round(n || 0).toLocaleString("id-ID");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** T-013 temuan QA 2: nilai ringkasan "-" (HPP tidak diketahui) tetap teks, angka -> rupiah. */
const rupiahOrDash = (v: number | string) => (typeof v === "string" ? v : rupiah(v));

/** Format 1 sel untuk output PDF/teks berdasarkan kind kolom. */
/** T-013 batch 13: baris ringkasan export untuk Uang Cair (semua saldo masuk) + rincian + saldo keluar. */
function uangCairSummary(r: { total: number; pesananPeriodeIni: number; pesananLain: number; penyesuaian: number; saldoKeluar: number }) {
  const out = [
    { label: UANG_CAIR_LABEL, value: rupiah(r.total) },
    { label: "Rincian", value: formatRincianUangCair(r) },
  ];
  const keluar = formatSaldoKeluar(r);
  if (keluar) out.push({ label: "Catatan", value: keluar });
  return out;
}

export function formatCell(value: any, kind: ColKind = "text"): string {
  if (value == null) return "";
  // Penanda teks di kolom angka (mis. "-" = tidak diketahui) tampil apa adanya, bukan "Rp 0".
  if (typeof value === "string" && kind !== "text") return value;
  if (kind === "money") return rupiah(Number(value));
  if (kind === "int") return int(Number(value));
  if (kind === "pct") return `${(Number(value) * 100).toFixed(1)}%`;
  return String(value);
}

/** Ubah ReportDataset -> baris array-of-array untuk buildTablePdf. */
export function datasetToPdfRows(ds: ReportDataset): (string | number)[][] {
  return ds.rows.map((r) => ds.columns.map((c) => formatCell(r[c.key], c.kind)));
}

const baseWhere = (f: ReportFilter): Prisma.OrderWhereInput => ({
  storeId: { in: f.storeIds },
  orderCreatedAt: { gte: f.from, lte: f.to },
  deletedAt: null,
});

// ---------------------------------------------------------------------------

/**
 * T-013 butir 15: SKU untuk kolom export. File Pesanan Shopee sering tidak punya SKU
 * (Order.sku kosong). Urutan: SKU di pesanan -> SKU Master Produk (lewat productId) -> "-".
 * Tidak pernah mengarang SKU.
 */
export function exportSku(o: { sku: string | null; product?: { sku: string | null } | null }): string {
  return o.sku?.trim() || o.product?.sku?.trim() || "-";
}
const PRODUCT_SKU = { select: { sku: true } } as const;

export async function datasetCashflow(f: ReportFilter, tab: string): Promise<ReportDataset> {
  const status =
    tab === "pending" ? OrderStatus.PENDING_SETTLEMENT : tab === "transit" ? OrderStatus.TRANSIT : OrderStatus.SELESAI;
  const label = tab === "pending" ? "Uang Mengambang" : tab === "transit" ? "Barang di Jalan (Transit)" : "Uang Cair (Selesai)";

  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status },
    include: { store: { select: { code: true, name: true } }, product: PRODUCT_SKU },
    orderBy: { orderCreatedAt: "desc" },
  });

  const rows = orders.map((o) => ({
    tanggal: ymd(o.orderCreatedAt),
    toko: o.store.code,
    noPesanan: o.orderSn,
    sku: exportSku(o),
    produk: o.productName,
    qty: o.qty,
    omzetBruto: o.grossOmzet,
    nilai: o.netSettlement,
  }));
  const totalGross = orders.reduce((s, o) => s + o.grossOmzet, 0);
  const totalNet = orders.reduce((s, o) => s + o.netSettlement, 0);

  return {
    title: `Cashflow - ${label}`,
    columns: [
      { key: "tanggal", header: "Tanggal", width: 10 },
      { key: "toko", header: "Toko", width: 8 },
      { key: "noPesanan", header: "No. Pesanan", width: 14 },
      { key: "sku", header: "SKU", width: 10 },
      { key: "produk", header: "Produk", width: 22 },
      { key: "qty", header: "Qty", width: 5, align: "right", kind: "int" },
      { key: "omzetBruto", header: "Omzet Pesanan", width: 12, align: "right", kind: "money" },
      { key: "nilai", header: "Nilai", width: 12, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Jumlah transaksi", value: int(orders.length) },
      { label: "Total omzet pesanan", value: rupiah(totalGross) },
      { label: "Total nilai", value: rupiah(totalNet) },
    ],
  };
}

export async function datasetProfit(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] } },
    select: { orderSn: true, sku: true, productId: true, productName: true, qty: true, grossOmzet: true, netSettlement: true, hppSnapshot: true, profitAgen: true, status: true, product: PRODUCT_SKU },
  });
  // Sama seperti route API-nya (src/app/api/reports/profit/route.ts): Unit Keluar/Omzet
  // Bruto hanya dari status Selesai; Profit Agen dari Selesai + Pending (independen dari
  // uang cair). Uang Cair/Profit HPP HARUS pakai nilai AKTUAL dari Income Report yang sudah
  // match lewat reconcile() (sama seperti /rekonsiliasi), BUKAN Order.netSettlement yang
  // cuma estimasi dari file Pesanan — order multi-item dialokasikan proporsional per baris
  // SKU lewat allocateActual(); order yang belum match (belum cair) tidak dihitung.
  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk tetap terpisah per nama produk.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile(f));
  const bySku = new Map<
    string,
    { sku: string; produk: string; qty: number; omzet: number; hpp: ProfitTally; agen: AgenTally }
  >();
  for (const o of orders) {
    const key = productGroupKey(o);
    const cur =
      bySku.get(key) ?? { sku: exportSku(o), produk: o.productName, qty: 0, omzet: 0, hpp: emptyTally(), agen: emptyAgenTally() };
    if (o.status === OrderStatus.SELESAI) {
      cur.qty += o.qty;
      cur.omzet += o.grossOmzet;

      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const groupAktual = aktualByOrderSn.get(o.orderSn);
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
      addProfitLine(cur.hpp, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    }
    addAgenLine(cur.agen, o);
    bySku.set(key, cur);
  }
  const totalOmzet = Array.from(bySku.values()).reduce((s, r) => s + r.omzet, 0);
  const numRows = Array.from(bySku.values())
    .map(({ hpp, agen, ...r }) => ({
      ...r,
      uangCair: hpp.uangCair,
      profitHpp: hpp.profitHpp,
      profitAgen: agen.profitAgen,
      tanpaHpp: hpp.tanpaHpp,
      selisih: agen.profitAgen - hpp.profitHpp,
      share: totalOmzet ? r.omzet / totalOmzet : 0,
    }))
    .sort((a, b) => b.profitHpp - a.profitHpp);
  const tQty = numRows.reduce((s, r) => s + r.qty, 0);
  const tUangCair = numRows.reduce((s, r) => s + r.uangCair, 0);
  const tHpp = numRows.reduce((s, r) => s + r.profitHpp, 0);
  const tAgen = numRows.reduce((s, r) => s + r.profitAgen, 0);
  // T-013 temuan QA 2: angka & urutan dihitung dari numRows; yang dikirim ke Excel/PDF memakai
  // nilai tampilan -- produk yang HPP-nya seluruhnya tidak diketahui -> "-" (bukan 0 / "Rp 0").
  const rows = numRows.map((r) => ({
    ...r,
    profitHpp: shownProfitHpp(r),
    profitAgen: shownProfitAgen(r),
    selisih: shownSelisih(r),
  }));
  const total = { profitHpp: tHpp, uangCair: tUangCair, tanpaHpp: sumTanpaHpp(numRows), profitAgen: tAgen, selisih: tAgen - tHpp };

  return {
    title: "Laporan Profit & Barang Keluar per SKU",
    columns: [
      { key: "sku", header: "SKU", width: 12 },
      { key: "produk", header: "Produk", width: 26 },
      { key: "qty", header: "Unit Keluar", width: 9, align: "right", kind: "int" },
      { key: "share", header: "Kontribusi Omzet", width: 9, align: "right", kind: "pct" },
      { key: "omzet", header: "Omzet Pesanan", width: 13, align: "right", kind: "money" },
      { key: "uangCair", header: UANG_CAIR_PESANAN_LABEL, width: 13, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP (Nett)", width: 13, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 13, align: "right", kind: "money" },
      { key: "selisih", header: "Selisih", width: 13, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total Unit Keluar", value: int(tQty) },
      { label: "Jumlah SKU Terjual", value: int(rows.length) },
      // T-013 batch 13 (tugas X): angka utama Uang Cair = semua saldo masuk periode ini.
      ...uangCairSummary(await getUangCairPeriode(f)),
      { label: UANG_CAIR_PESANAN_LABEL, value: rupiah(tUangCair) },
      { label: "Catatan", value: PROFIT_BASIS_NOTE },
      { label: "Total Profit HPP (Nett)", value: rupiahOrDash(shownProfitHpp(total)) },
      { label: "Total Profit Agen", value: rupiahOrDash(shownProfitAgen(total)) },
      { label: "Selisih Agen vs Riil", value: rupiahOrDash(shownSelisih(total)) },
      { label: TANPA_HPP_LABEL, value: tanpaHppValue(total.tanpaHpp) },
    ],
  };
}

export async function datasetBarangKeluar(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: OrderStatus.SELESAI },
    select: { orderSn: true, sku: true, productId: true, productName: true, qty: true, grossOmzet: true, netSettlement: true, hppSnapshot: true, product: PRODUCT_SKU },
  });
  // Uang Cair/Profit HPP HARUS pakai nilai AKTUAL dari Income Report yang sudah match lewat
  // reconcile(), BUKAN Order.netSettlement yang cuma estimasi — lihat datasetProfit() di atas.
  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk tetap terpisah per nama produk.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile(f));
  const bySku = new Map<string, any>();
  for (const o of orders) {
    const key = productGroupKey(o);
    // cur menyimpan field ProfitTally (profitHpp, uangCair, tanpaHpp) langsung -> addProfitLine(cur).
    const cur = bySku.get(key) ?? { sku: exportSku(o), produk: o.productName, qty: 0, omzet: 0, ...emptyTally() };
    cur.qty += o.qty;
    cur.omzet += o.grossOmzet;

    const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
    const groupAktual = aktualByOrderSn.get(o.orderSn);
    const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
    addProfitLine(cur, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    bySku.set(key, cur);
  }
  const totalQty = Array.from(bySku.values()).reduce((s, r) => s + r.qty, 0);
  const rows = Array.from(bySku.values())
    .sort((a, b) => b.qty - a.qty)
    .map((r, i) => ({ rank: i + 1, ...r, share: totalQty ? r.qty / totalQty : 0 }));

  return {
    title: "Analisis Barang Keluar (status Selesai)",
    columns: [
      { key: "rank", header: "#", width: 4, align: "right", kind: "int" },
      { key: "sku", header: "SKU", width: 12 },
      { key: "produk", header: "Produk", width: 30 },
      { key: "qty", header: "Unit Keluar", width: 9, align: "right", kind: "int" },
      { key: "share", header: "Kontribusi", width: 9, align: "right", kind: "pct" },
      { key: "omzet", header: "Omzet Pesanan", width: 13, align: "right", kind: "money" },
      { key: "uangCair", header: UANG_CAIR_PESANAN_LABEL, width: 13, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 13, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total unit keluar", value: int(totalQty) },
      { label: "Jumlah SKU terjual", value: int(bySku.size) },
      { label: `Total ${UANG_CAIR_PESANAN_LABEL.toLowerCase()}`, value: rupiah(rows.reduce((s, r) => s + r.uangCair, 0)) },
      { label: TANPA_HPP_LABEL, value: tanpaHppValue(sumTanpaHpp(rows)) },
    ],
  };
}

/** Agregat retur & batal untuk kartu ringkasan halaman. */
export async function returnsSummary(f: ReportFilter) {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: { in: [OrderStatus.CANCEL, OrderStatus.RETUR] } },
    select: { status: true, qty: true, returCondition: true, hppSnapshot: true },
  });
  const batal = orders.filter((o) => o.status === OrderStatus.CANCEL);
  const retur = orders.filter((o) => o.status === OrderStatus.RETUR);
  const good = retur.filter((o) => o.returCondition === "GOOD");
  const damaged = retur.filter((o) => o.returCondition === "DAMAGED");
  const belum = retur.filter((o) => !o.returCondition);
  const sumQty = (a: typeof orders) => a.reduce((s, o) => s + o.qty, 0);
  return {
    batal: { count: batal.length, unit: sumQty(batal) },
    retur: { count: retur.length, unit: sumQty(retur) },
    layakRestok: { count: good.length, unit: sumQty(good) },
    rusak: {
      count: damaged.length,
      unit: sumQty(damaged),
      // T-013 butir 16: retur rusak tanpa HPP tidak dijumlah (kerugian tidak diketahui), dihitung di tanpaHpp.
      ...sumReturLoss(damaged),
    },
    belumDiklasifikasi: { count: belum.length, unit: sumQty(belum) },
  };
}

export async function datasetReturns(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: { in: [OrderStatus.CANCEL, OrderStatus.RETUR] } },
    include: { store: { select: { code: true } }, product: PRODUCT_SKU },
    orderBy: { orderCreatedAt: "desc" },
  });
  const kondisi = (o: (typeof orders)[number]) =>
    o.status === OrderStatus.CANCEL
      ? "-"
      : o.returCondition === "GOOD"
        ? "Bagus (restok)"
        : o.returCondition === "DAMAGED"
          ? "Rusak/Cacat"
          : "Belum diklasifikasi";
  const rows = orders.map((o) => ({
    tanggal: ymd(o.orderCreatedAt),
    toko: o.store.code,
    noPesanan: o.orderSn,
    sku: exportSku(o),
    produk: o.productName,
    qty: o.qty,
    status: o.status === OrderStatus.CANCEL ? "Batal" : "Retur",
    kondisi: kondisi(o),
    // T-013 butir 16: retur rusak tanpa HPP -> "-" (tidak diketahui), bukan 0.
    kerugianHpp: returLoss(o) ?? "-",
  }));
  const s = await returnsSummary(f);
  return {
    title: "Analisis Retur & Pembatalan",
    columns: [
      { key: "tanggal", header: "Tanggal", width: 10 },
      { key: "toko", header: "Toko", width: 8 },
      { key: "noPesanan", header: "No. Pesanan", width: 14 },
      { key: "sku", header: "SKU", width: 11 },
      { key: "produk", header: "Produk", width: 24 },
      { key: "qty", header: "Qty", width: 5, align: "right", kind: "int" },
      { key: "status", header: "Status", width: 7 },
      { key: "kondisi", header: "Kondisi Barang", width: 14 },
      { key: "kerugianHpp", header: "Kerugian HPP", width: 12, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Batal (transaksi / unit)", value: `${int(s.batal.count)} / ${int(s.batal.unit)}` },
      { label: "Retur (transaksi / unit)", value: `${int(s.retur.count)} / ${int(s.retur.unit)}` },
      { label: "Retur layak restok (unit)", value: int(s.layakRestok.unit) },
      { label: "Retur rusak (unit)", value: int(s.rusak.unit) },
      { label: "Beban kerugian HPP (retur rusak)", value: rupiah(s.rusak.kerugianHpp) },
      ...(s.rusak.tanpaHpp.baris > 0
        ? [{ label: "Retur rusak tanpa HPP (kerugian tidak dihitung)", value: `${int(s.rusak.tanpaHpp.baris)} baris` }]
        : []),
      { label: "Retur belum diklasifikasi (unit)", value: int(s.belumDiklasifikasi.unit) },
    ],
  };
}

export async function storePerformanceRows(f: ReportFilter) {
  const stores = await prisma.store.findMany({
    where: { id: { in: f.storeIds } },
    select: { id: true, code: true, name: true },
  });
  const orders = await prisma.order.findMany({
    where: baseWhere(f),
    select: {
      storeId: true,
      orderSn: true,
      status: true,
      qty: true,
      grossOmzet: true,
      netSettlement: true,
      hppSnapshot: true,
      profitAgen: true,
    },
  });
  // Uang Cair/Profit HPP HARUS pakai nilai AKTUAL dari Income Report yang sudah match lewat
  // reconcile() (sama seperti /rekonsiliasi & Laporan Profit), BUKAN Order.netSettlement/
  // profitHpp yang cuma estimasi dari file Pesanan — order multi-item dialokasikan
  // proporsional per baris lewat allocateActual(); order yang belum match (belum cair)
  // tidak dihitung. uangMengambang (PENDING_SETTLEMENT) tetap estimasi -- memang belum cair.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile(f));

  const byStore = new Map<string, any>();
  for (const st of stores) {
    byStore.set(st.id, {
      toko: `${st.code} - ${st.name}`,
      order: 0,
      unitKeluar: 0,
      omzet: 0,
      uangCair: 0,
      uangMengambang: 0,
      profitHpp: 0,
      tanpaHpp: { baris: 0, uangCair: 0 },
      profitAgen: 0,
      agen: emptyAgenTally(),
    });
  }
  for (const o of orders) {
    const row = byStore.get(o.storeId);
    if (!row) continue;
    row.order += 1;
    if (o.status !== OrderStatus.CANCEL) row.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) {
      row.unitKeluar += o.qty;

      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const groupAktual = aktualByOrderSn.get(o.orderSn);
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, groupAktual);
      // row menyimpan field ProfitTally (profitHpp, uangCair, tanpaHpp) langsung.
      addProfitLine(row, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    }
    if (o.status === OrderStatus.PENDING_SETTLEMENT) row.uangMengambang += o.netSettlement;
    if (o.status === OrderStatus.SELESAI || o.status === OrderStatus.PENDING_SETTLEMENT) addAgenLine(row.agen, o);
  }
  return Array.from(byStore.values())
    .map(({ agen, ...r }) => ({ ...r, profitAgen: agen.profitAgen }))
    .sort((a, b) => b.omzet - a.omzet);
}

export async function datasetStorePerformance(f: ReportFilter): Promise<ReportDataset> {
  const numRows = await storePerformanceRows(f);
  // T-013 temuan QA 2: toko yang HPP-nya seluruhnya tidak diketahui -> "-" di Profit HPP/Agen.
  const rows = numRows.map((r) => ({ ...r, profitHpp: shownProfitHpp(r), profitAgen: shownProfitAgen(r) }));
  const totalPerforma = {
    profitHpp: numRows.reduce((s, r) => s + r.profitHpp, 0),
    uangCair: numRows.reduce((s, r) => s + r.uangCair, 0),
    tanpaHpp: sumTanpaHpp(numRows),
  };
  return {
    title: "Performa Toko",
    columns: [
      { key: "toko", header: "Toko", width: 22 },
      { key: "order", header: "Order", width: 7, align: "right", kind: "int" },
      { key: "unitKeluar", header: "Unit Keluar", width: 9, align: "right", kind: "int" },
      { key: "omzet", header: "Omzet Pesanan", width: 13, align: "right", kind: "money" },
      { key: "uangCair", header: UANG_CAIR_PESANAN_LABEL, width: 13, align: "right", kind: "money" },
      { key: "uangMengambang", header: "Mengambang", width: 13, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 13, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 13, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total omzet pesanan", value: rupiah(numRows.reduce((s, r) => s + r.omzet, 0)) },
      { label: `Total ${UANG_CAIR_PESANAN_LABEL.toLowerCase()}`, value: rupiah(totalPerforma.uangCair) },
      { label: "Total profit HPP", value: rupiahOrDash(shownProfitHpp(totalPerforma)) },
      { label: TANPA_HPP_LABEL, value: tanpaHppValue(totalPerforma.tanpaHpp) },
    ],
  };
}

export async function datasetRecap(f: ReportFilter, type: string): Promise<ReportDataset> {
  const setting = await prisma.periodSetting.findFirst();
  const cutoffDay = setting?.cutoffDay ?? 25;
  const orders = await prisma.order.findMany({
    where: { storeId: { in: f.storeIds }, status: { not: OrderStatus.CANCEL }, deletedAt: null },
    select: { orderSn: true, orderCreatedAt: true, grossOmzet: true, netSettlement: true, hppSnapshot: true, qty: true, status: true },
  });
  // Sama persis dengan /api/reports/recap (src/lib/recap.ts): semua bulan, bulan dihitung dari
  // tanggal pesanan dibuat (WIB) + cut-off saat ini, tahun = tahun periode, selisih vs bulan tepat
  // sebelumnya. reconcile() rentang seluas mungkin supaya semua order ter-cover Income Report.
  const lookup = buildActualLookup(await reconcile({ storeIds: f.storeIds, from: new Date(0), to: new Date() }));
  // T-013 batch 13 (tugas X): kolom Uang Cair = semua saldo masuk per bulan periode (sama dgn API rekap).
  const { months, years } = buildRecap(orders, lookup, cutoffDay, await getUangCairPerBulan(f.storeIds, cutoffDay));

  if (type === "yearly") {
    // T-013 temuan QA 2: tahun yang HPP-nya seluruhnya tidak diketahui -> Profit HPP "-".
    const rows = years.map((r) => ({ tahun: r.year, omzet: r.omzet, uangCair: r.uangCairTotal, profitHpp: shownProfitHpp(r), tanpaHpp: r.tanpaHpp }));
    return {
      title: "Rekap Tahunan (Multi-Toko)",
      columns: [
        { key: "tahun", header: "Tahun", width: 10 },
        { key: "omzet", header: "Omzet Pesanan", width: 18, align: "right", kind: "money" },
        { key: "uangCair", header: "Uang Cair (semua saldo masuk)", width: 18, align: "right", kind: "money" },
        { key: "profitHpp", header: "Profit HPP", width: 18, align: "right", kind: "money" },
      ],
      rows,
      summary: [{ label: "Catatan", value: PROFIT_BASIS_NOTE }, { label: TANPA_HPP_LABEL, value: tanpaHppValue(sumTanpaHpp(rows)) }],
    };
  }

  const rows = months.map((r) => ({
    periode: r.label,
    omzet: r.omzet,
    uangCair: r.uangCairTotal,
    // T-013 temuan QA 2: bulan yang HPP-nya seluruhnya tidak diketahui -> "-" (bukan "Rp 0").
    profitHpp: shownProfitHpp(r),
    tanpaHpp: r.tanpaHpp,
    // bulan tepat sebelumnya tidak ada data -> "-" (bukan 0 / 0%)
    selisih: r.deltaOmzet ?? "-",
    selisihPct: r.deltaPct == null ? "-" : `${r.deltaPct.toFixed(1)}%`,
  }));
  return {
    title: "Rekap Bulanan (Cut-Off 26-25) & Komparasi",
    columns: [
      { key: "periode", header: "Periode Cut-Off", width: 24 },
      { key: "omzet", header: "Omzet Pesanan", width: 14, align: "right", kind: "money" },
      { key: "uangCair", header: "Uang Cair (semua saldo masuk)", width: 14, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 14, align: "right", kind: "money" },
      { key: "selisih", header: "Selisih Omzet vs Bulan Lalu", width: 14, align: "right", kind: "money" },
      { key: "selisihPct", header: "%", width: 7, align: "right" },
    ],
    rows,
    summary: [{ label: "Catatan", value: PROFIT_BASIS_NOTE }, { label: TANPA_HPP_LABEL, value: tanpaHppValue(sumTanpaHpp(rows)) }],
  };
}

export async function datasetOrders(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: baseWhere(f),
    include: { store: { select: { code: true, name: true } }, product: PRODUCT_SKU },
    orderBy: [{ storeId: "asc" }, { orderCreatedAt: "desc" }],
  });
  const statusLabel: Record<string, string> = {
    CANCEL: "Batal",
    RETUR: "Retur",
    TRANSIT: "Transit",
    PENDING_SETTLEMENT: "Belum Cair",
    SELESAI: "Selesai",
  };
  // T-013: rumus SAMA dengan Laporan Profit -- Uang Cair = nilai AKTUAL dari Income Report
  // (reconcile + allocateActual; belum cair -> 0), Profit HPP/Agen hanya untuk baris yang HPP-nya
  // diketahui. Baris tanpa HPP: profit 0 di kolom, ditandai tanpaHpp=true, dan dijumlah di ringkasan.
  // BUKAN lagi kolom Order.profitHpp/profitAgen tersimpan.
  const { estimasiByOrderSn, aktualByOrderSn } = buildActualLookup(await reconcile(f));
  const total = emptyTally();
  const rows = orders.map((o) => {
    const line = emptyTally();
    if (o.status === OrderStatus.SELESAI) {
      const groupEstimasi = estimasiByOrderSn.get(o.orderSn) ?? o.netSettlement;
      const lineAktual = allocateActual(o.netSettlement, groupEstimasi, aktualByOrderSn.get(o.orderSn));
      addProfitLine(line, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
      addProfitLine(total, { qty: o.qty, hppSnapshot: o.hppSnapshot, uangCair: lineAktual });
    }
    return {
      toko: o.store.code,
      noPesanan: o.orderSn,
      sku: exportSku(o),
      produk: o.productName,
      qty: o.qty,
      status: statusLabel[o.status] ?? o.status,
      tanggal: ymd(o.orderCreatedAt),
      omzetBruto: o.grossOmzet,
      uangCair: line.uangCair,
      profitHpp: line.profitHpp,
      profitAgen: lineProfitAgen(o) ?? 0,
      tanpaHpp: line.tanpaHpp.baris > 0,
    };
  });
  return {
    title: "Detail Semua Pesanan",
    columns: [
      { key: "toko", header: "Toko", width: 8 },
      { key: "noPesanan", header: "No. Pesanan", width: 13 },
      { key: "sku", header: "SKU", width: 10 },
      { key: "produk", header: "Produk", width: 20 },
      { key: "qty", header: "Qty", width: 5, align: "right", kind: "int" },
      { key: "status", header: "Status", width: 8 },
      { key: "tanggal", header: "Tanggal", width: 9 },
      { key: "omzetBruto", header: "Omzet Pesanan", width: 11, align: "right", kind: "money" },
      { key: "uangCair", header: UANG_CAIR_PESANAN_LABEL, width: 11, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 11, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 11, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: `Total ${UANG_CAIR_PESANAN_LABEL.toLowerCase()}`, value: rupiah(total.uangCair) },
      { label: "Total profit HPP", value: rupiah(total.profitHpp) },
      { label: TANPA_HPP_LABEL, value: tanpaHppValue(total.tanpaHpp) },
    ],
  };
}

export type ReportKey =
  | "cashflow"
  | "profit"
  | "barang-keluar"
  | "retur"
  | "performa-toko"
  | "recap"
  | "orders";

export async function buildReportDataset(
  report: ReportKey,
  f: ReportFilter,
  opts: { tab?: string; type?: string }
): Promise<ReportDataset> {
  switch (report) {
    case "cashflow":
      return datasetCashflow(f, opts.tab ?? "cair");
    case "profit":
      return datasetProfit(f);
    case "barang-keluar":
      return datasetBarangKeluar(f);
    case "retur":
      return datasetReturns(f);
    case "performa-toko":
      return datasetStorePerformance(f);
    case "recap":
      return datasetRecap(f, opts.type ?? "monthly");
    case "orders":
      return datasetOrders(f);
    default:
      throw new Error(`report tidak dikenal: ${report}`);
  }
}
