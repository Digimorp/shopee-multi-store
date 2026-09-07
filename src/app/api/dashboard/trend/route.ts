import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { OrderStatus } from "@prisma/client";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: { not: OrderStatus.CANCEL },
    },
    select: { orderCreatedAt: true, grossOmzet: true, profitHpp: true, status: true },
  });

  const byDate = new Map<string, { omzet: number; profit: number }>();
  for (const o of orders) {
    const key = format(o.orderCreatedAt, "yyyy-MM-dd");
    const cur = byDate.get(key) ?? { omzet: 0, profit: 0 };
    cur.omzet += o.grossOmzet;
    if (o.status === OrderStatus.SELESAI) cur.profit += o.profitHpp;
    byDate.set(key, cur);
  }

  const trend = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, omzet: v.omzet, profit: v.profit }));

  return NextResponse.json({ trend });
}
