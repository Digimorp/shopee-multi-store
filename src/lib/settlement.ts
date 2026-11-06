// Logika pencairan MURNI (tanpa Prisma/DB) — aman di-import dari client component
// (mis. halaman /rekonsiliasi) maupun server (src/lib/reconciliation.ts me-re-export ini).

/** Status pencairan per No. Pesanan — SELALU diturunkan dari baris SKU + entri income, tidak disimpan. */
export type SettleStatus = "AKTUAL" | "SEBAGIAN" | "BELUM";

/** Entri income yang berarti dana DIKEMBALIKAN (refund/retur sebagian), bukan penghasilan. */
export function isRefundEntry(e: { amount: number; raw: unknown }): boolean {
  if (e.amount < 0) return true;
  const raw = (e.raw ?? {}) as Record<string, unknown>;
  const tipe = `${raw["Tipe Transaksi"] ?? ""} ${raw["Deskripsi"] ?? ""}`;
  return /pengembalian|refund/i.test(tipe);
}

/**
 * Status pencairan 1 No. Pesanan, diturunkan dari status tiap baris SKU + entri income-nya.
 * Income Report Shopee mencatat payout PER No. Pesanan (tanpa SKU/qty), jadi "sebagian" hanya
 * bisa diketahui dari sinyal nyata — bukan ditebak dari nominal:
 *   - belum ada payout                                         -> BELUM
 *   - ada payout + (ada baris RETUR, atau ada entri refund)    -> SEBAGIAN
 *   - ada payout, semua baris terjual, tanpa refund            -> AKTUAL
 */
export function deriveSettleStatus(lines: { status: string }[], income: { hasRefund: boolean } | null): SettleStatus {
  if (!income) return "BELUM";
  const anyRetur = lines.some((l) => l.status === "RETUR");
  return anyRetur || income.hasRefund ? "SEBAGIAN" : "AKTUAL";
}

/**
 * Alokasikan nilai aktual 1 No. Pesanan (payout Shopee, tidak dipecah per SKU) ke 1 baris
 * SKU di dalamnya, proporsional terhadap porsi estimasi baris itu dari total estimasi
 * order-nya (order multi-item = beberapa baris SKU, 1 payout gabungan). Return null kalau
 * order itu belum match ke Income Report (belum cair) -- baris itu TIDAK dihitung sebagai
 * Uang Cair/Profit HPP, sesuai definisi rekonsiliasi (lihat /rekonsiliasi, stage "Menunggu Cair").
 */
export function allocateActual(lineEstimasi: number, groupEstimasi: number, groupAktual: number | undefined): number | null {
  if (groupAktual == null) return null;
  if (groupEstimasi <= 0) return 0;
  return groupAktual * (lineEstimasi / groupEstimasi);
}

type DiffableItem = {
  orderSn: string;
  side?: string;
  category: string;
  settleStatus: string;
  stage: string;
  aktual: number | null;
};

/**
 * Bandingkan 2 hasil reconcile() (sebelum vs sesudah "Sync ulang") per No. Pesanan.
 * `changed` = order yang kategori / status cair / tahap / nilai aktual-nya berubah.
 */
export function diffReconItems(
  prev: DiffableItem[],
  next: DiffableItem[]
): { changed: number; added: number; removed: number; total: number } {
  const key = (i: DiffableItem) => `${i.side ?? ""}|${i.orderSn}`;
  const before = new Map(prev.map((i) => [key(i), i]));
  let changed = 0;
  let added = 0;
  for (const n of next) {
    const p = before.get(key(n));
    if (!p) {
      added++;
      continue;
    }
    before.delete(key(n));
    const aktualBeda = p.aktual == null ? n.aktual != null : n.aktual == null || Math.abs(n.aktual - p.aktual) > 0.5;
    if (p.category !== n.category || p.settleStatus !== n.settleStatus || p.stage !== n.stage || aktualBeda) changed++;
  }
  return { changed, added, removed: before.size, total: next.length };
}

/**
 * Nilai aktual per BARIS SKU untuk tabel yang menampilkan 1 baris = 1 SKU. Payout order dibagi
 * proporsional ke barisnya (allocateActual), sehingga total = payout order, dihitung SEKALI —
 * bukan payout order ditempel utuh ke tiap baris (dulu: order 2 baris terhitung 2x).
 */
export function allocateLines<L extends { orderSn: string; netSettlement: number }>(
  lines: L[],
  byOrderSn: Map<string, { estimasi: number; aktual: number | null }>
): { perLine: (number | null)[]; total: number; matchedOrders: number } {
  const perLine = lines.map((l) => {
    const rc = byOrderSn.get(l.orderSn);
    return allocateActual(l.netSettlement, rc?.estimasi ?? 0, rc?.aktual ?? undefined);
  });
  const total = perLine.reduce<number>((s, v) => s + (v ?? 0), 0);
  const matchedOrders = new Set(lines.filter((_, i) => perLine[i] != null).map((l) => l.orderSn)).size;
  return { perLine, total, matchedOrders };
}

export type SettlementLine = {
  id: string;
  sku: string;
  productName: string;
  qty: number;
  status: string;
  grossOmzet: number;
  netSettlement: number;
  hppSnapshot: number; // HPP per unit
  profitAgen: number;
};

export type SettlementRow = SettlementLine & { uangCair: number | null; profitHpp: number | null; selisih: number | null };

/**
 * Breakdown per baris SKU untuk 1 No. Pesanan (popup Settlement Details). Rumus SAMA dengan
 * Laporan Profit (src/lib/reports.ts datasetProfit): Uang Cair = alokasi aktual proporsional,
 * Profit HPP = Uang Cair − HPP×qty, Selisih = Profit Agen − Profit HPP. Baris CANCEL tidak ikut
 * (sama seperti reconcile()). Order belum cair -> Uang Cair/Profit HPP/Selisih = null, BUKAN 0.
 */
export function settlementBreakdown(
  lines: SettlementLine[],
  order: { estimasi: number; aktual: number | null } | undefined
): { rows: SettlementRow[]; totals: { grossOmzet: number; uangCair: number | null; profitHpp: number | null; profitAgen: number; selisih: number | null } } {
  const active = lines.filter((l) => l.status !== "CANCEL");
  const groupEstimasi = order?.estimasi ?? active.reduce((s, l) => s + l.netSettlement, 0);
  const rows: SettlementRow[] = active.map((l) => {
    const uangCair = allocateActual(l.netSettlement, groupEstimasi, order?.aktual ?? undefined);
    const profitHpp = uangCair == null ? null : uangCair - l.hppSnapshot * l.qty;
    return { ...l, uangCair, profitHpp, selisih: profitHpp == null ? null : l.profitAgen - profitHpp };
  });
  const sumOrNull = (k: "uangCair" | "profitHpp" | "selisih") =>
    rows.some((r) => r[k] != null) ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) : null;
  return {
    rows,
    totals: {
      grossOmzet: rows.reduce((s, r) => s + r.grossOmzet, 0),
      uangCair: sumOrNull("uangCair"),
      profitHpp: sumOrNull("profitHpp"),
      profitAgen: rows.reduce((s, r) => s + r.profitAgen, 0),
      selisih: sumOrNull("selisih"),
    },
  };
}
