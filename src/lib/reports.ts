import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPeriodForDate, formatPeriodLabel, parsePeriodKey } from "@/lib/period";

export type ColKind = "text" | "int" | "money" | "pct";
export type ReportColumn = { key: string; header: string; width: number; align?: "left" | "right"; kind?: ColKind };
export type ReportDataset = {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: { label: string; value: string }[];
};

export type ReportFilter = { storeIds: string[]; from: Date; to: Date };

const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const int = (n: number) => Math.round(n || 0).toLocaleString("id-ID");
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Format 1 sel untuk output PDF/teks berdasarkan kind kolom. */
export function formatCell(value: any, kind: ColKind = "text"): string {
  if (value == null) return "";
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
});

// ---------------------------------------------------------------------------

export async function datasetCashflow(f: ReportFilter, tab: string): Promise<ReportDataset> {
  const status =
    tab === "pending" ? OrderStatus.PENDING_SETTLEMENT : tab === "transit" ? OrderStatus.TRANSIT : OrderStatus.SELESAI;
  const label = tab === "pending" ? "Uang Mengambang" : tab === "transit" ? "Barang di Jalan (Transit)" : "Uang Cair (Selesai)";

  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status },
    include: { store: { select: { code: true, name: true } } },
    orderBy: { orderCreatedAt: "desc" },
  });

  const rows = orders.map((o) => ({
    tanggal: ymd(o.orderCreatedAt),
    toko: o.store.code,
    noPesanan: o.orderSn,
    sku: o.sku,
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
      { key: "omzetBruto", header: "Omzet Bruto", width: 12, align: "right", kind: "money" },
      { key: "nilai", header: "Nilai", width: 12, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Jumlah transaksi", value: int(orders.length) },
      { label: "Total omzet bruto", value: rupiah(totalGross) },
      { label: "Total nilai", value: rupiah(totalNet) },
    ],
  };
}

export async function datasetProfit(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] } },
    select: { sku: true, productName: true, qty: true, profitHpp: true, profitAgen: true },
  });
  const bySku = new Map<string, { sku: string; produk: string; qty: number; profitHpp: number; profitAgen: number }>();
  for (const o of orders) {
    const cur = bySku.get(o.sku) ?? { sku: o.sku, produk: o.productName, qty: 0, profitHpp: 0, profitAgen: 0 };
    cur.qty += o.qty;
    cur.profitHpp += o.profitHpp;
    cur.profitAgen += o.profitAgen;
    bySku.set(o.sku, cur);
  }
  const rows = Array.from(bySku.values())
    .map((r) => ({ ...r, selisih: r.profitAgen - r.profitHpp }))
    .sort((a, b) => b.profitHpp - a.profitHpp);
  const tHpp = rows.reduce((s, r) => s + r.profitHpp, 0);
  const tAgen = rows.reduce((s, r) => s + r.profitAgen, 0);

  return {
    title: "Laporan Profit per SKU",
    columns: [
      { key: "sku", header: "SKU", width: 12 },
      { key: "produk", header: "Produk", width: 34 },
      { key: "qty", header: "Qty Terjual", width: 8, align: "right", kind: "int" },
      { key: "profitHpp", header: "Profit HPP (Nett)", width: 14, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 14, align: "right", kind: "money" },
      { key: "selisih", header: "Selisih", width: 14, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total Profit HPP (Nett)", value: rupiah(tHpp) },
      { label: "Total Profit Agen", value: rupiah(tAgen) },
      { label: "Selisih Agen vs Riil", value: rupiah(tAgen - tHpp) },
    ],
  };
}

export async function datasetBarangKeluar(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: OrderStatus.SELESAI },
    select: { sku: true, productName: true, qty: true, grossOmzet: true, netSettlement: true, profitHpp: true },
  });
  const bySku = new Map<string, any>();
  for (const o of orders) {
    const cur = bySku.get(o.sku) ?? { sku: o.sku, produk: o.productName, qty: 0, omzet: 0, uangCair: 0, profitHpp: 0 };
    cur.qty += o.qty;
    cur.omzet += o.grossOmzet;
    cur.uangCair += o.netSettlement;
    cur.profitHpp += o.profitHpp;
    bySku.set(o.sku, cur);
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
      { key: "omzet", header: "Omzet Bruto", width: 13, align: "right", kind: "money" },
      { key: "uangCair", header: "Uang Cair", width: 13, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 13, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total unit keluar", value: int(totalQty) },
      { label: "Jumlah SKU terjual", value: int(bySku.size) },
      { label: "Total uang cair", value: rupiah(rows.reduce((s, r) => s + r.uangCair, 0)) },
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
      kerugianHpp: damaged.reduce((s, o) => s + o.hppSnapshot * o.qty, 0),
    },
    belumDiklasifikasi: { count: belum.length, unit: sumQty(belum) },
  };
}

export async function datasetReturns(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: { ...baseWhere(f), status: { in: [OrderStatus.CANCEL, OrderStatus.RETUR] } },
    include: { store: { select: { code: true } } },
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
    sku: o.sku,
    produk: o.productName,
    qty: o.qty,
    status: o.status === OrderStatus.CANCEL ? "Batal" : "Retur",
    kondisi: kondisi(o),
    kerugianHpp: o.status === OrderStatus.RETUR && o.returCondition === "DAMAGED" ? o.hppSnapshot * o.qty : 0,
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
      status: true,
      qty: true,
      grossOmzet: true,
      netSettlement: true,
      profitHpp: true,
      profitAgen: true,
    },
  });
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
      profitAgen: 0,
    });
  }
  for (const o of orders) {
    const row = byStore.get(o.storeId);
    if (!row) continue;
    row.order += 1;
    if (o.status !== OrderStatus.CANCEL) row.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) {
      row.unitKeluar += o.qty;
      row.uangCair += o.netSettlement;
      row.profitHpp += o.profitHpp;
    }
    if (o.status === OrderStatus.PENDING_SETTLEMENT) row.uangMengambang += o.netSettlement;
    if (o.status === OrderStatus.SELESAI || o.status === OrderStatus.PENDING_SETTLEMENT) row.profitAgen += o.profitAgen;
  }
  return Array.from(byStore.values()).sort((a, b) => b.omzet - a.omzet);
}

export async function datasetStorePerformance(f: ReportFilter): Promise<ReportDataset> {
  const rows = await storePerformanceRows(f);
  return {
    title: "Performa Toko",
    columns: [
      { key: "toko", header: "Toko", width: 22 },
      { key: "order", header: "Order", width: 7, align: "right", kind: "int" },
      { key: "unitKeluar", header: "Unit Keluar", width: 9, align: "right", kind: "int" },
      { key: "omzet", header: "Omzet Bruto", width: 13, align: "right", kind: "money" },
      { key: "uangCair", header: "Uang Cair", width: 13, align: "right", kind: "money" },
      { key: "uangMengambang", header: "Mengambang", width: 13, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 13, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 13, align: "right", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Total omzet bruto", value: rupiah(rows.reduce((s, r) => s + r.omzet, 0)) },
      { label: "Total uang cair", value: rupiah(rows.reduce((s, r) => s + r.uangCair, 0)) },
      { label: "Total profit HPP", value: rupiah(rows.reduce((s, r) => s + r.profitHpp, 0)) },
    ],
  };
}

export async function datasetRecap(f: ReportFilter, type: string): Promise<ReportDataset> {
  const setting = await prisma.periodSetting.findFirst();
  const cutoffDay = setting?.cutoffDay ?? 25;
  const orders = await prisma.order.findMany({
    where: { storeId: { in: f.storeIds }, status: { not: OrderStatus.CANCEL } },
    select: { orderCreatedAt: true, grossOmzet: true, profitHpp: true, status: true, periodKey: true },
  });

  if (type === "yearly") {
    const byYear = new Map<string, { tahun: string; omzet: number; profitHpp: number }>();
    for (const o of orders) {
      const yr = String(o.orderCreatedAt.getFullYear());
      const cur = byYear.get(yr) ?? { tahun: yr, omzet: 0, profitHpp: 0 };
      cur.omzet += o.grossOmzet;
      if (o.status === OrderStatus.SELESAI) cur.profitHpp += o.profitHpp;
      byYear.set(yr, cur);
    }
    return {
      title: "Rekap Tahunan (Multi-Toko)",
      columns: [
        { key: "tahun", header: "Tahun", width: 10 },
        { key: "omzet", header: "Omzet", width: 20, align: "right", kind: "money" },
        { key: "profitHpp", header: "Profit HPP", width: 20, align: "right", kind: "money" },
      ],
      rows: Array.from(byYear.values()).sort((a, b) => (a.tahun < b.tahun ? 1 : -1)),
    };
  }

  const byPeriod = new Map<string, { periodKey: string; periode: string; omzet: number; profitHpp: number }>();
  for (const o of orders) {
    const key = o.periodKey || getPeriodForDate(o.orderCreatedAt, cutoffDay).key;
    const cur =
      byPeriod.get(key) ?? { periodKey: key, periode: formatPeriodLabel(parsePeriodKey(key)), omzet: 0, profitHpp: 0 };
    cur.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) cur.profitHpp += o.profitHpp;
    byPeriod.set(key, cur);
  }
  const sorted = Array.from(byPeriod.values()).sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
  const rows = sorted.map((r, i) => {
    const prev = sorted[i + 1];
    const deltaOmzet = prev ? r.omzet - prev.omzet : 0;
    const deltaPct = prev && prev.omzet !== 0 ? (deltaOmzet / prev.omzet) * 100 : 0;
    return {
      periode: r.periode,
      omzet: r.omzet,
      profitHpp: r.profitHpp,
      selisih: deltaOmzet,
      selisihPct: `${deltaPct.toFixed(1)}%`,
    };
  });
  return {
    title: "Rekap Bulanan (Cut-Off 26-25) & Komparasi",
    columns: [
      { key: "periode", header: "Periode Cut-Off", width: 20 },
      { key: "omzet", header: "Omzet", width: 16, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 16, align: "right", kind: "money" },
      { key: "selisih", header: "Selisih vs Lalu", width: 16, align: "right", kind: "money" },
      { key: "selisihPct", header: "%", width: 8, align: "right" },
    ],
    rows,
  };
}

export async function datasetOrders(f: ReportFilter): Promise<ReportDataset> {
  const orders = await prisma.order.findMany({
    where: baseWhere(f),
    include: { store: { select: { code: true, name: true } } },
    orderBy: [{ storeId: "asc" }, { orderCreatedAt: "desc" }],
  });
  const statusLabel: Record<string, string> = {
    CANCEL: "Batal",
    RETUR: "Retur",
    TRANSIT: "Transit",
    PENDING_SETTLEMENT: "Belum Cair",
    SELESAI: "Selesai",
  };
  const rows = orders.map((o) => ({
    toko: o.store.code,
    noPesanan: o.orderSn,
    sku: o.sku,
    produk: o.productName,
    qty: o.qty,
    status: statusLabel[o.status] ?? o.status,
    tanggal: ymd(o.orderCreatedAt),
    omzetBruto: o.grossOmzet,
    uangCair: o.status === OrderStatus.SELESAI ? o.netSettlement : 0,
    profitHpp: o.profitHpp,
    profitAgen: o.profitAgen,
  }));
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
      { key: "omzetBruto", header: "Omzet Bruto", width: 11, align: "right", kind: "money" },
      { key: "uangCair", header: "Uang Cair", width: 11, align: "right", kind: "money" },
      { key: "profitHpp", header: "Profit HPP", width: 11, align: "right", kind: "money" },
      { key: "profitAgen", header: "Profit Agen", width: 11, align: "right", kind: "money" },
    ],
    rows,
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
