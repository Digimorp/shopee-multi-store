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
      status: { not: OrderStatus.CANCEL },
    },
    select: { sku: true, productName: true, qty: true, grossOmzet: true },
  });

  const bySku = new Map<string, { sku: string; name: string; omzet: number; qty: number }>();
  for (const o of orders) {
    const cur = bySku.get(o.sku) ?? { sku: o.sku, name: o.productName, omzet: 0, qty: 0 };
    cur.omzet += o.grossOmzet;
    cur.qty += o.qty;
    bySku.set(o.sku, cur);
  }

  const all = Array.from(bySku.values());
  const byOmzet = [...all].sort((a, b) => b.omzet - a.omzet).slice(0, 15);
  const byQty = [...all].sort((a, b) => b.qty - a.qty).slice(0, 15);

  return NextResponse.json({ byOmzet, byQty });
}
