import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MATCH_TOLERANCE = 5; // Rp — selisih <= ini dianggap MATCH (pembulatan)
export const FINAL_LOCK_DAYS = 14; // "Cair Final" hanya setelah H+14 dari Selesai
export const STUCK_DAYS = 7; // "Sampai" > 7 hari belum Selesai -> flag retur pending

export type ReconCategory = "MATCH" | "SELISIH" | "BELUM_KETEMU";
export type SettlementStage = "SAMPAI" | "MENUNGGU_CAIR" | "CAIR" | "CAIR_FINAL";

export type ReconItem = {
  orderSn: string;
  storeCode: string;
  productName: string;
  qty: number;
  status: OrderStatus;
  estimasi: number; // Order.netSettlement (dari data Pesanan)
  aktual: number | null; // IncomeEntry.amount (dari Income Report) — null kalau belum ketemu
  selisih: number | null; // aktual - estimasi
  category: ReconCategory;
  side: "order" | "income" | "both";
  stage: SettlementStage;
  isEstimasi: boolean; // true = angka yang dipakai masih estimasi (belum ada Income Report matched)
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
  items: ReconItem[];
  adjustments: AdjustmentItem[];
};

export type ReconFilter = { storeIds: string[]; from: Date; to: Date };

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

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

export async function reconcile(f: ReconFilter): Promise<ReconResult> {
  const now = new Date();

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: f.storeIds },
      orderCreatedAt: { gte: f.from, lte: f.to },
      status: { not: OrderStatus.CANCEL },
    },
    include: { store: { select: { code: true } } },
    orderBy: { orderCreatedAt: "desc" },
  });

  // Semua orderSn milik toko-toko ini (lintas periode) — untuk deteksi income yg
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

  // Map orderSn -> entri income terbaru (kalau ada import overlap ganda)
  const incomeByOrderSn = new Map<string, (typeof incomeEntries)[number]>();
  for (const e of incomeEntries) {
    if (e.type !== "ORDER" || !e.orderSn) continue;
    const cur = incomeByOrderSn.get(e.orderSn);
    if (!cur || e.import.createdAt > cur.import.createdAt) incomeByOrderSn.set(e.orderSn, e);
  }

  const items: ReconItem[] = [];
  const matchedIncomeOrderSns = new Set<string>();

  for (const o of orders) {
    const inc = incomeByOrderSn.get(o.orderSn) ?? null;
    const estimasi = o.netSettlement;
    let category: ReconCategory;
    let side: ReconItem["side"];
    let aktual: number | null = null;
    let selisih: number | null = null;

    if (inc) {
      matchedIncomeOrderSns.add(o.orderSn);
      aktual = inc.amount;
      selisih = aktual - estimasi;
      category = Math.abs(selisih) <= MATCH_TOLERANCE ? "MATCH" : "SELISIH";
      side = "both";
    } else {
      category = "BELUM_KETEMU";
      side = "order";
    }

    const stage = deriveStage(o, inc, now);
    const flags: string[] = [];
    const ref = o.completedAt ?? o.orderCreatedAt;
    if (
      !inc &&
      (o.status === OrderStatus.TRANSIT || o.status === OrderStatus.PENDING_SETTLEMENT) &&
      daysBetween(ref, now) > STUCK_DAYS
    ) {
      flags.push("SAMPAI_7H_BELUM_CAIR");
    }
    if (o.status === OrderStatus.RETUR) flags.push("RETUR");

    items.push({
      orderSn: o.orderSn,
      storeCode: o.store.code,
      productName: o.productName,
      qty: o.qty,
      status: o.status,
      estimasi,
      aktual,
      selisih,
      category,
      side,
      stage,
      isEstimasi: !inc,
      flags,
      releasedAt: inc?.releasedAt ? inc.releasedAt.toISOString() : null,
      orderCreatedAt: o.orderCreatedAt.toISOString(),
    });
  }

  // Entri income ORDER yang ordernya benar-benar tidak ada di DB toko ini -> BELUM_KETEMU sisi income
  for (const [orderSn, e] of incomeByOrderSn) {
    if (matchedIncomeOrderSns.has(orderSn)) continue;
    if (allOrderSns.has(orderSn)) continue; // order ada tapi di luar periode -> abaikan
    items.push({
      orderSn,
      storeCode: "-",
      productName: e.description ?? "(dari Income Report)",
      qty: 0,
      status: OrderStatus.SELESAI,
      estimasi: 0,
      aktual: e.amount,
      selisih: e.amount,
      category: "BELUM_KETEMU",
      side: "income",
      stage: "CAIR",
      isEstimasi: false,
      flags: ["ORDER_TIDAK_ADA_DI_DB"],
      releasedAt: e.releasedAt ? e.releasedAt.toISOString() : null,
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
    total: items.length,
    matchPct: 0,
  };
  rate.matchPct = rate.total ? rate.match / rate.total : 0;

  const reconciled = items.filter((i) => i.aktual != null);
  const totals = {
    estimasi: items.reduce((s, i) => s + i.estimasi, 0),
    aktual: reconciled.reduce((s, i) => s + (i.aktual ?? 0), 0),
    selisih: reconciled.reduce((s, i) => s + (i.selisih ?? 0), 0),
    adjustment: adjustments.reduce((s, a) => s + a.amount, 0),
  };

  return { rate, totals, items, adjustments };
}
