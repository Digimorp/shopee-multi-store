import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

// Riwayat perubahan HPP / Harga Katalog produk (audit log). Read-only.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku");
  const take = Math.min(200, Number(searchParams.get("limit") ?? 50));

  const logs = await prisma.productPriceLog.findMany({
    where: sku ? { sku } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: { changedBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      sku: l.sku,
      name: l.name,
      oldHpp: l.oldHpp,
      newHpp: l.newHpp,
      oldCatalog: l.oldCatalog,
      newCatalog: l.newCatalog,
      source: l.source,
      changedBy: l.changedBy?.name ?? l.changedBy?.email ?? "-",
      createdAt: l.createdAt,
    })),
  });
}
