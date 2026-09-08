import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getAccessibleStoreIds } from "@/lib/rbac";

// Riwayat import Income Report (semua versi, termasuk yang superseded).
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get("storeId");
  const accessible = await getAccessibleStoreIds(user);
  const storeIds =
    storeIdParam && storeIdParam !== "all"
      ? accessible.includes(storeIdParam)
        ? [storeIdParam]
        : []
      : accessible;
  if (storeIds.length === 0) return NextResponse.json({ imports: [] });

  const imports = await prisma.incomeImport.findMany({
    where: { storeId: { in: storeIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      store: { select: { code: true, name: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    imports: imports.map((i) => ({
      id: i.id,
      store: i.store.code,
      fileName: i.fileName,
      version: i.version,
      isSuperseded: i.isSuperseded,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
      orderRows: i.orderRows,
      adjustmentRows: i.adjustmentRows,
      totalRows: i.totalRows,
      uploadedBy: i.uploadedBy?.name ?? "-",
      createdAt: i.createdAt,
    })),
  });
}
