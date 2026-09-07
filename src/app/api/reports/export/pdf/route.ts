import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { buildSimplePdf } from "@/lib/export";
import { formatPeriodLabel, makePeriod } from "@/lib/period";
import { OrderStatus } from "@prisma/client";

function rupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [omzet, cair, pending, transit, profitHpp, profitAgen] = await Promise.all([
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: { not: OrderStatus.CANCEL } }, _sum: { grossOmzet: true } }),
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: OrderStatus.SELESAI }, _sum: { netSettlement: true } }),
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: OrderStatus.PENDING_SETTLEMENT }, _sum: { netSettlement: true } }),
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: OrderStatus.TRANSIT }, _sum: { netSettlement: true } }),
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: OrderStatus.SELESAI }, _sum: { profitHpp: true } }),
    prisma.order.aggregate({ where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to }, status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] } }, _sum: { profitAgen: true } }),
  ]);

  const lines = [
    `Periode: ${formatPeriodLabel(makePeriod(from, to))}`,
    "",
    `Total Omzet Bruto     : ${rupiah(omzet._sum.grossOmzet ?? 0)}`,
    `Uang Cair (Selesai)   : ${rupiah(cair._sum.netSettlement ?? 0)}`,
    `Uang Mengambang       : ${rupiah(pending._sum.netSettlement ?? 0)}`,
    `Barang Transit        : ${rupiah(transit._sum.netSettlement ?? 0)}`,
    `Profit HPP (Nett)     : ${rupiah(profitHpp._sum.profitHpp ?? 0)}`,
    `Profit Agen           : ${rupiah(profitAgen._sum.profitAgen ?? 0)}`,
  ];

  const buffer = await buildSimplePdf("Laporan Rekapan Penjualan Shopee", lines);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="laporan-rekap-${Date.now()}.pdf"`,
    },
  });
}
