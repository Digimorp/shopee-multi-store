import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { OrderStatus } from "@prisma/client";

// Analisis barang keluar / Top Produk — HANYA status SELESAI (barang benar-benar laku & cair).
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: OrderStatus.SELESAI,
    },
    select: { sku: true, productName: true, qty: true, grossOmzet: true, netSettlement: true, profitHpp: true },
  });

  const bySku = new Map<
    string,
    { sku: string; name: string; omzet: number; uangCair: number; profitHpp: number; qty: number }
  >();
  for (const o of orders) {
    const cur =
      bySku.get(o.sku) ?? { sku: o.sku, name: o.productName, omzet: 0, uangCair: 0, profitHpp: 0, qty: 0 };
    cur.omzet += o.grossOmzet;
    cur.uangCair += o.netSettlement;
    cur.profitHpp += o.profitHpp;
    cur.qty += o.qty;
    bySku.set(o.sku, cur);
  }

  const all = Array.from(bySku.values());
  const totalQty = all.reduce((s, r) => s + r.qty, 0);
  const allRanked = [...all]
    .sort((a, b) => b.qty - a.qty)
    .map((r, i) => ({ ...r, rank: i + 1, share: totalQty ? r.qty / totalQty : 0 }));

  const byOmzet = [...all].sort((a, b) => b.omzet - a.omzet).slice(0, 15);
  const byQty = [...all].sort((a, b) => b.qty - a.qty).slice(0, 15);

  return NextResponse.json({ byOmzet, byQty, all: allRanked, totalQty, skuCount: all.length });
}
