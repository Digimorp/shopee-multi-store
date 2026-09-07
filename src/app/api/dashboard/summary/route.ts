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

  const baseWhere = { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to } };

  const [omzetBruto, uangCair, uangMengambang, transit, profitHpp, profitAgen] = await Promise.all([
    prisma.order.aggregate({
      where: { ...baseWhere, status: { not: OrderStatus.CANCEL } },
      _sum: { grossOmzet: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.SELESAI },
      _sum: { netSettlement: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.PENDING_SETTLEMENT },
      _sum: { netSettlement: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.TRANSIT },
      _sum: { netSettlement: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: OrderStatus.SELESAI },
      _sum: { profitHpp: true },
    }),
    prisma.order.aggregate({
      where: { ...baseWhere, status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] } },
      _sum: { profitAgen: true },
    }),
  ]);

  return NextResponse.json({
    totalOmzetBruto: omzetBruto._sum.grossOmzet ?? 0,
    uangCair: uangCair._sum.netSettlement ?? 0,
    uangMengambang: uangMengambang._sum.netSettlement ?? 0,
    barangTransit: transit._sum.netSettlement ?? 0,
    profitHpp: profitHpp._sum.profitHpp ?? 0,
    profitAgen: profitAgen._sum.profitAgen ?? 0,
  });
}
