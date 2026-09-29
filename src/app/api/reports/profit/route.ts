import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { productGroupKey } from "@/lib/profit";
import { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      orderCreatedAt: { gte: from, lte: to },
      status: { in: [OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT] },
      deletedAt: null,
    },
    select: {
      sku: true,
      productId: true,
      productName: true,
      qty: true,
      grossOmzet: true,
      netSettlement: true,
      profitHpp: true,
      profitAgen: true,
      status: true,
      store: { select: { code: true, name: true } },
    },
  });

  // Unit Keluar/Omzet Bruto/Uang Cair = HANYA status Selesai (barang benar-benar laku & cair,
  // sama seperti Analisis Barang Keluar dulu). Profit HPP/Profit Agen tetap dari SELESAI +
  // PENDING_SETTLEMENT (profitHpp sudah 0 di DB utk baris non-Selesai, jadi totalnya sama saja;
  // profitAgen memang direalisasi juga saat PENDING_SETTLEMENT — lihat src/app/api/upload/route.ts).
  // Kunci grup pakai productGroupKey (productId -> sku -> nama produk), BUKAN sku mentah —
  // order yang belum ter-link Master Produk (productId null & sku kosong) tetap terpisah
  // per nama produk, tidak collapse jadi satu baris gabungan.
  const bySku = new Map<
    string,
    { sku: string; name: string; qty: number; omzet: number; uangCair: number; profitHpp: number; profitAgen: number }
  >();
  for (const o of orders) {
    const key = productGroupKey(o);
    const cur =
      bySku.get(key) ?? { sku: o.sku, name: o.productName, qty: 0, omzet: 0, uangCair: 0, profitHpp: 0, profitAgen: 0 };
    if (o.status === OrderStatus.SELESAI) {
      cur.qty += o.qty;
      cur.omzet += o.grossOmzet;
      cur.uangCair += o.netSettlement;
    }
    cur.profitHpp += o.profitHpp;
    cur.profitAgen += o.profitAgen;
    bySku.set(key, cur);
  }

  const totalOmzet = Array.from(bySku.values()).reduce((s, r) => s + r.omzet, 0);
  const rows = Array.from(bySku.values()).map((r) => ({
    ...r,
    selisih: r.profitAgen - r.profitHpp,
    share: totalOmzet ? r.omzet / totalOmzet : 0,
  }));
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalUangCair = rows.reduce((s, r) => s + r.uangCair, 0);
  const totalProfitHpp = rows.reduce((s, r) => s + r.profitHpp, 0);
  const totalProfitAgen = rows.reduce((s, r) => s + r.profitAgen, 0);

  return NextResponse.json({
    rows: rows.sort((a, b) => b.profitHpp - a.profitHpp),
    summary: {
      totalQty,
      skuCount: rows.length,
      totalUangCair,
      totalProfitHpp,
      totalProfitAgen,
      selisih: totalProfitAgen - totalProfitHpp,
    },
  });
}
