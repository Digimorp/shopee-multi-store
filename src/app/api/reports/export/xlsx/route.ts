import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { buildXlsx } from "@/lib/export";
import { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to } },
    include: { store: { select: { code: true, name: true } } },
    orderBy: [{ storeId: "asc" }, { orderCreatedAt: "desc" }],
  });

  const rows = orders.map((o) => ({
    toko: o.store.name,
    noPesanan: o.orderSn,
    sku: o.sku,
    produk: o.productName,
    qty: o.qty,
    status: o.status,
    tanggal: o.orderCreatedAt.toISOString().slice(0, 10),
    omzetBruto: o.grossOmzet,
    uangCair: o.status === OrderStatus.SELESAI ? o.netSettlement : 0,
    profitHpp: o.profitHpp,
    profitAgen: o.profitAgen,
  }));

  const buffer = await buildXlsx("Laporan Penjualan", [
    { header: "Toko", key: "toko", width: 24 },
    { header: "No. Pesanan", key: "noPesanan", width: 20 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Produk", key: "produk", width: 28 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Status", key: "status", width: 18 },
    { header: "Tanggal", key: "tanggal", width: 14 },
    { header: "Omzet Bruto", key: "omzetBruto", width: 16 },
    { header: "Uang Cair", key: "uangCair", width: 16 },
    { header: "Profit HPP", key: "profitHpp", width: 16 },
    { header: "Profit Agen", key: "profitAgen", width: 16 },
  ], rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-penjualan-${Date.now()}.xlsx"`,
    },
  });
}
