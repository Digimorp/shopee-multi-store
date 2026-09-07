import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] },
    },
    select: {
      sku: true,
      productName: true,
      qty: true,
      profitHpp: true,
      profitAgen: true,
      status: true,
      store: { select: { code: true, name: true } },
    },
  });

  const bySku = new Map<
    string,
    { sku: string; name: string; qty: number; profitHpp: number; profitAgen: number }
  >();
  for (const o of orders) {
    const cur = bySku.get(o.sku) ?? { sku: o.sku, name: o.productName, qty: 0, profitHpp: 0, profitAgen: 0 };
    cur.qty += o.qty;
    cur.profitHpp += o.profitHpp;
    cur.profitAgen += o.profitAgen;
    bySku.set(o.sku, cur);
  }

  const rows = Array.from(bySku.values()).map((r) => ({ ...r, selisih: r.profitAgen - r.profitHpp }));
  const totalProfitHpp = rows.reduce((s, r) => s + r.profitHpp, 0);
  const totalProfitAgen = rows.reduce((s, r) => s + r.profitAgen, 0);

  return NextResponse.json({
    rows: rows.sort((a, b) => b.profitHpp - a.profitHpp),
    summary: { totalProfitHpp, totalProfitAgen, selisih: totalProfitAgen - totalProfitHpp },
  });
}
