import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { OrderStatus } from "@prisma/client";

// Action: tandai retur sebagai "Restok Gudang" (GOOD) atau "Barang Rusak/Cacat" (DAMAGED)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const condition = body.condition as "GOOD" | "DAMAGED";
  if (!["GOOD", "DAMAGED"].includes(condition)) {
    return NextResponse.json({ error: "condition harus GOOD atau DAMAGED" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status !== OrderStatus.RETUR) {
    return NextResponse.json({ error: "Order ini bukan status Retur" }, { status: 400 });
  }

  const storeIds = await assertStoreAccess(user, order.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { returCondition: condition },
  });

  return NextResponse.json({ order: updated });
}
