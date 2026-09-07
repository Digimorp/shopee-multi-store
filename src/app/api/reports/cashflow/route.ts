import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { OrderStatus } from "@prisma/client";

const TAB_STATUS: Record<string, OrderStatus> = {
  cair: OrderStatus.SELESAI,
  pending: OrderStatus.PENDING_SETTLEMENT,
  transit: OrderStatus.TRANSIT,
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "cair";
  const status = TAB_STATUS[tab] ?? OrderStatus.SELESAI;

  const orders = await prisma.order.findMany({
    where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status },
    include: { store: { select: { code: true, name: true } } },
    orderBy: { orderCreatedAt: "desc" },
  });

  const totalGross = orders.reduce((s, o) => s + o.grossOmzet, 0);
  const totalNet = orders.reduce((s, o) => s + o.netSettlement, 0);
  const totalFee = orders.reduce((s, o) => s + o.adminFee, 0);

  return NextResponse.json({ orders, summary: { totalGross, totalNet, totalFee, count: orders.length } });
}
