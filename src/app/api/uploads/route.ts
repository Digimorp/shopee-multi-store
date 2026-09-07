import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getAccessibleStoreIds } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessible = await getAccessibleStoreIds(user);
  const logs = await prisma.uploadLog.findMany({
    where: { storeId: { in: accessible } },
    include: { store: { select: { code: true, name: true } }, admin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ logs });
}
