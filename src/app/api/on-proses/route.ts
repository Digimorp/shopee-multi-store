import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { buildOnProses } from "@/lib/onProses";

// T-013 batch 15 (bagian D): pesanan belum final (Transit + Belum Cair) dari SEMUA periode.
// Hanya filter Toko (hak akses toko lewat assertStoreAccess: Admin Toko hanya tokonya); TIDAK ikut
// filter Periode. Data = tabel orders apa adanya (tanpa schema baru, tanpa rumus baru).
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeIds = await assertStoreAccess(user, new URL(req.url).searchParams.get("storeId"));
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      status: { in: [OrderStatus.TRANSIT, OrderStatus.PENDING_SETTLEMENT] },
      deletedAt: null,
    },
    select: {
      orderSn: true,
      orderCreatedAt: true,
      productName: true,
      status: true,
      grossOmzet: true,
      store: { select: { code: true } },
    },
  });

  return NextResponse.json(
    buildOnProses(
      orders.map((o) => ({
        orderSn: o.orderSn,
        orderCreatedAt: o.orderCreatedAt,
        storeCode: o.store?.code ?? "-",
        productName: o.productName,
        status: o.status,
        grossOmzet: o.grossOmzet,
      }))
    )
  );
}
