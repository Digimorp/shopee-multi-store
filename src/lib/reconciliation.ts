import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MATCH_TOLERANCE = 5; // Rp — selisih persis <= ini = MATCH (kasus format lama: estimasi = payout riil)
export const FINAL_LOCK_DAYS = 14; // "Cair Final" hanya setelah H+14 dari Selesai
export const STUCK_DAYS = 7; // "Sampai" > 7 hari belum Selesai -> flag retur pending

// Skema resmi export Pesanan tidak punya kolom payout, jadi `estimasi` = Subtotal Pesanan
// (nilai kotor pesanan). Payout AKTUAL Shopee selalu lebih kecil ~potongan biaya admin/
// layanan/program. Untuk membedakan "cair wajar" vs "anomali", kita hitung rasio payout
// khas toko (median aktual/estimasi dari data yang sudah ketemu) lalu bandingkan tiap
// order ke ekspektasi itu — bukan langsung ke estimasi kotor.
export const MATCH_RESIDUAL_PCT = 0.1; // sisa deviasi terhadap ekspektasi payout masih dianggap MATCH
export const MIN_RATIO_SAMPLES = 15; // < ini: data belum cukup, anggap rasio = 1 (estimasi = payout)

function median(nums: number[]): number {
  if (nums.length === 0) return 1;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type ReconCategory = "MATCH" | "SELISIH" | "BELUM_KETEMU" | "N/A";
export type SettlementStage = "SAMPAI" | "MENUNGGU_CAIR" | "CAIR" | "CAIR_FINAL";

export type ReconItem = {
  orderSn: string;
  storeCode: string;
  productName: string;
  qty: number;
  status: OrderStatus;
  estimasi: number; // sum Order.netSettlement per No. Pesanan (dari data Pesanan)
  aktual: number | null; // sum IncomeEntry.amount per No. Pesanan (Income Report) — null kalau belum ketemu
  selisih: number | null; // aktual - estimasi
  category: ReconCategory;
  side: "order" | "income" | "both";
  stage: SettlementStage;
  isEstimasi: boolean; // true = angka masih estimasi (belum ada Income Report matched)
  flags: string[];
  releasedAt: string | null;
  orderCreatedAt: string | null;
};

export type AdjustmentItem = {
  storeCode: string;
  kind: string;
  description: string | null;
  amount: number;
  releasedAt: string | null;
};

export type ReconResult = {
  rate: { match: number; selisih: number; belumKetemu: number; total: number; matchPct: number };
  totals: { estimasi: number; aktual: number; selisih: number; adjustment: number };
  payoutRatio: number; // median aktual/estimasi toko (1 = estimasi sudah = payout / data belum cukup)
  items: ReconItem[];
  adjustments: AdjustmentItem[];
};

export type ReconFilter = { storeIds: string[]; from: Date; to: Date };

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

// Urutan "keterwakilan" status untuk pesanan multi-item (1 No. Pesanan, banyak baris SKU).
const STATUS_RANK: Record<OrderStatus, number> = {
  [OrderStatus.SELESAI]: 5,
  [OrderStatus.PENDING_SETTLEMENT]: 4,
  [OrderStatus.TRANSIT]: 3,
  [OrderStatus.RETUR]: 2,
  [OrderStatus.CANCEL]: 1,
};

/** Tahap pencairan per order (SAMPAI -> MENUNGGU_CAIR -> CAIR -> CAIR_FINAL). */
export function deriveStage(
  order: { status: OrderStatus; orderCreatedAt: Date; completedAt: Date | null; settlementDate: Date | null },
  income: { releasedAt: Date | null } | null,
  now = new Date()
): SettlementStage {
  if (income) {
    const ref = order.settlementDate ?? order.completedAt ?? income.releasedAt ?? order.orderCreatedAt;
    return daysBetween(ref, now) >= FINAL_LOCK_DAYS ? "CAIR_FINAL" : "CAIR";
  }
  if (order.status === OrderStatus.TRANSIT) return "SAMPAI";
  return "MENUNGGU_CAIR"; // PENDING_SETTLEMENT / SELESAI belum ada Income Report / RETUR
}

type IncomeAgg = { amount: number; releasedAt: Date | null; importAt: Date };

export async function reconcile(f: ReconFilter): Promise<ReconResult> {
  const now = new Date();

  const orderRows = await prisma.order.findMany({
    where: {
      storeId: { in: f.storeIds },
      orderCreatedAt: { gte: f.from, lte: f.to },
      status: { not: OrderStatus.CANCEL },
    },
    include: { store: { select: { code: true } } },
    orderBy: { orderCreatedAt: "desc" },
  });

  // Gabung baris per No. Pesanan (pesanan multi-item = beberapa baris SKU, 1 payout).
  type OrderGroup = {
    orderSn: string;
    storeCode: string;
    productName: string;
    qty: number;
    status: OrderStatus;
    estimasi: number;
    orderCreatedAt: Date;
    completedAt: Date | null;
    settlementDate: Date | null;
  };
  const groups = new Map<string, OrderGroup>();
  for (const o of orderRows) {
    const g = groups.get(o.orderSn);
    if (!g) {
      groups.set(o.orderSn, {
        orderSn: o.orderSn,
        storeCode: o.store.code,
        productName: o.productName,
        qty: o.qty,
        status: o.status,
        estimasi: o.netSettlement,
        orderCreatedAt: o.orderCreatedAt,
        completedAt: o.completedAt,
        settlementDate: o.settlementDate,
      });
    } else {
      g.qty += o.qty;
      g.estimasi += o.netSettlement;
      if (STATUS_RANK[o.status] > STATUS_RANK[g.status]) g.status = o.status;
      if (o.orderCreatedAt < g.orderCreatedAt) g.orderCreatedAt = o.orderCreatedAt;
      if (o.completedAt && (!g.completedAt || o.completedAt > g.completedAt)) g.completedAt = o.completedAt;
      if (o.settlementDate && (!g.settlementDate || o.settlementDate > g.settlementDate))
        g.settlementDate = o.settlementDate;
      if (!g.productName.includes(" +")) g.productName = `${g.productName} +lainnya`;
    }
  }

  // Semua orderSn milik toko-toko ini (lintas periode) — untuk deteksi income yang
  // ordernya ada tapi di luar periode (jangan salah tandai "belum ketemu").
  const allOrderSns = new Set(
    (await prisma.order.findMany({ where: { storeId: { in: f.storeIds } }, select: { orderSn: true } })).map(
      (o) => o.orderSn
    )
  );

  // Entri Income Report AKTIF (import non-superseded)
  const incomeEntries = await prisma.incomeEntry.findMany({
    where: { storeId: { in: f.storeIds }, import: { isSuperseded: false } },
    include: { import: { select: { createdAt: true } } },
  });

  // Jumlahkan entri ORDER per No. Pesanan (bisa ada >1 baris: penghasilan + potongan/biaya).
  // Kalau ada import overlap ganda, pakai import TERBARU saja.
  const incomeByOrderSn = new Map<string, IncomeAgg>();
  for (const e of incomeEntries) {
    if (e.type !== "ORDER" || !e.orderSn) continue;
    const cur = incomeByOrderSn.get(e.orderSn);
    if (!cur || e.import.createdAt > cur.importAt) {
      incomeByOrderSn.set(e.orderSn, { amount: e.amount, releasedAt: e.releasedAt, importAt: e.import.createdAt });
    } else if (e.import.createdAt.getTime() === cur.importAt.getTime()) {
      cur.amount += e.amount;
      if (e.releasedAt && (!cur.releasedAt || e.releasedAt > cur.releasedAt)) cur.releasedAt = e.releasedAt;
    }
  }

  // Rasio payout khas toko: median(aktual / estimasi) dari order yang sudah ketemu.
  // Dipakai untuk membedakan "potongan Shopee wajar" (MATCH) vs "anomali" (SELISIH).
  const ratioSamples: number[] = [];
  for (const g of groups.values()) {
    const inc = incomeByOrderSn.get(g.orderSn);
    if (inc && g.estimasi > 0 && inc.amount > 0) ratioSamples.push(inc.amount / g.estimasi);
  }
  const payoutRatio = ratioSamples.length >= MIN_RATIO_SAMPLES ? median(ratioSamples) : 1;

  const items: ReconItem[] = [];
  const matchedIncomeOrderSns = new Set<string>();

  for (const g of groups.values()) {
    const inc = incomeByOrderSn.get(g.orderSn) ?? null;
    const estimasi = g.estimasi;
    let category: ReconCategory;
    let side: ReconItem["side"];
    let aktual: number | null = null;
    let selisih: number | null = null;

    const incomeExpected = g.status === OrderStatus.SELESAI || g.status === OrderStatus.PENDING_SETTLEMENT;

    if (inc) {
      matchedIncomeOrderSns.add(g.orderSn);
      aktual = inc.amount;
      selisih = aktual - estimasi; // selalu = aktual - nilai kotor pesanan (biar terlihat drag biayanya)
      // Ekspektasi payout = estimasi * rasio khas toko. Anggap MATCH kalau aktual dekat
      // ekspektasi itu (atau persis sama dengan estimasi, kasus format lama), dan aktual > 0.
      const expected = estimasi * payoutRatio;
      const tol = Math.max(MATCH_TOLERANCE, expected * MATCH_RESIDUAL_PCT);
      const ok = aktual > 0 && (Math.abs(selisih) <= MATCH_TOLERANCE || Math.abs(aktual - expected) <= tol);
      category = ok ? "MATCH" : "SELISIH";
      side = "both";
    } else if (incomeExpected) {
      category = "BELUM_KETEMU"; // SELESAI/PENDING tapi belum ada di Income Report
      side = "order";
    } else {
      category = "N/A"; // TRANSIT / RETUR — belum jatuh tempo cair, tidak dihitung di rate
      side = "order";
    }

    const stage = deriveStage(g, inc ? { releasedAt: inc.releasedAt } : null, now);
    const flags: string[] = [];
    const ref = g.completedAt ?? g.orderCreatedAt;
    if (
      !inc &&
      (g.status === OrderStatus.TRANSIT || g.status === OrderStatus.PENDING_SETTLEMENT) &&
      daysBetween(ref, now) > STUCK_DAYS
    ) {
      flags.push("SAMPAI_7H_BELUM_CAIR");
    }
    if (g.status === OrderStatus.RETUR) flags.push("RETUR");

    items.push({
      orderSn: g.orderSn,
      storeCode: g.storeCode,
      productName: g.productName,
      qty: g.qty,
      status: g.status,
      estimasi,
      aktual,
      selisih,
      category,
      side,
      stage,
      isEstimasi: !inc,
      flags,
      releasedAt: inc?.releasedAt ? inc.releasedAt.toISOString() : null,
      orderCreatedAt: g.orderCreatedAt.toISOString(),
    });
  }

  // Entri income ORDER yang ordernya benar-benar tidak ada di DB toko ini -> BELUM_KETEMU sisi income
  for (const [orderSn, agg] of incomeByOrderSn) {
    if (matchedIncomeOrderSns.has(orderSn)) continue;
    if (allOrderSns.has(orderSn)) continue; // order ada tapi di luar periode -> abaikan
    items.push({
      orderSn,
      storeCode: "-",
      productName: "(dari Income Report)",
      qty: 0,
      status: OrderStatus.SELESAI,
      estimasi: 0,
      aktual: agg.amount,
      selisih: agg.amount,
      category: "BELUM_KETEMU",
      side: "income",
      stage: "CAIR",
      isEstimasi: false,
      flags: ["ORDER_TIDAK_ADA_DI_DB"],
      releasedAt: agg.releasedAt ? agg.releasedAt.toISOString() : null,
      orderCreatedAt: null,
    });
  }

  const adjustments: AdjustmentItem[] = incomeEntries
    .filter((e) => e.type === "ADJUSTMENT")
    .map((e) => ({
      storeCode: "-",
      kind: e.adjustmentKind ?? "Adjustment",
      description: e.description,
      amount: e.amount,
      releasedAt: e.releasedAt ? e.releasedAt.toISOString() : null,
    }));

  const rate = {
    match: items.filter((i) => i.category === "MATCH").length,
    selisih: items.filter((i) => i.category === "SELISIH").length,
    belumKetemu: items.filter((i) => i.category === "BELUM_KETEMU").length,
    total: 0,
    matchPct: 0,
  };
  rate.total = rate.match + rate.selisih + rate.belumKetemu; // N/A (TRANSIT/RETUR) tidak dihitung
  rate.matchPct = rate.total ? rate.match / rate.total : 0;

  const reconciled = items.filter((i) => i.aktual != null);
  const totals = {
    estimasi: items.reduce((s, i) => s + i.estimasi, 0),
    aktual: reconciled.reduce((s, i) => s + (i.aktual ?? 0), 0),
    selisih: reconciled.reduce((s, i) => s + (i.selisih ?? 0), 0),
    adjustment: adjustments.reduce((s, a) => s + a.amount, 0),
  };

  return { rate, totals, payoutRatio, items, adjustments };
}
