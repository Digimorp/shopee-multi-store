import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { getOrderLockInfo } from "@/lib/reconciliation";
import { logAudit } from "@/lib/audit";
import { OrderStatus } from "@prisma/client";

const STATUS_VALUES = Object.values(OrderStatus);

// Edit 1 baris Order. orderSn TIDAK BOLEH diubah (kunci matching Rekonsiliasi).
// Kalau order sudah CAIR/CAIR FINAL, `reason` wajib diisi (lihat aturan RBAC/lock di README).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.deletedAt) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const storeIds = await assertStoreAccess(user, order.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden - toko tidak dikuasakan" }, { status: 403 });

  const body = await req.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const lock = await getOrderLockInfo(order.orderSn, order.storeId);
  if (lock.locked && !reason) {
    return NextResponse.json(
      {
        error:
          "Order ini sudah direkonsiliasi (status Cair/Cair Final). Mengubahnya bisa bikin laporan keuangan tidak akurat — isi alasan untuk melanjutkan.",
        locked: true,
        stage: lock.stage,
      },
      { status: 400 }
    );
  }

  if (body.status !== undefined && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: `status harus salah satu dari: ${STATUS_VALUES.join(", ")}` }, { status: 400 });
  }

  const before: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  const setIfChanged = (field: "productName" | "status" | "qty" | "grossOmzet" | "netSettlement", value: unknown) => {
    if (value === undefined) return;
    const next = field === "qty" ? Math.round(Number(value)) : field === "grossOmzet" || field === "netSettlement" ? Number(value) : value;
    if (Number.isNaN(next as number)) return;
    if (next === (order as any)[field]) return;
    before[field] = (order as any)[field];
    data[field] = next;
  };
  setIfChanged("productName", body.productName);
  setIfChanged("status", body.status);
  setIfChanged("qty", body.qty);
  setIfChanged("grossOmzet", body.grossOmzet);
  setIfChanged("netSettlement", body.netSettlement);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { ...data, updatedById: user.id },
  });

  await logAudit({
    actor: user,
    action: "EDIT",
    entityType: "Order",
    entityId: order.id,
    entityLabel: order.orderSn,
    storeId: order.storeId,
    reason: reason || null,
    before,
    after: data,
  });

  return NextResponse.json({ order: updated });
}

// Soft-delete 1 baris Order. Diblokir total kalau order sudah CAIR/CAIR FINAL.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.deletedAt) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const storeIds = await assertStoreAccess(user, order.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden - toko tidak dikuasakan" }, { status: 403 });

  const lock = await getOrderLockInfo(order.orderSn, order.storeId);
  if (lock.locked) {
    return NextResponse.json(
      {
        error:
          "Order ini sudah direkonsiliasi (status Cair/Cair Final) dan tidak boleh dihapus. Hubungi Owner untuk koreksi manual lewat Adjustment.",
        locked: true,
        stage: lock.stage,
      },
      { status: 403 }
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    actor: user,
    action: "DELETE",
    entityType: "Order",
    entityId: order.id,
    entityLabel: order.orderSn,
    storeId: order.storeId,
    before: order,
  });

  return NextResponse.json({ ok: true });
}
