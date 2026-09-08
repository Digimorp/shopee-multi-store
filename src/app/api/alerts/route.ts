import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { OrderStatus } from "@prisma/client";

// Ambang "uang mengambang" — bisa di-override lewat env, default Rp 5.000.000.
const MENGAMBANG_THRESHOLD = Number(process.env.ALERT_MENGAMBANG_THRESHOLD ?? 5_000_000);

export type AlertItem = { level: "warning" | "info"; title: string; detail: string };

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ items: [], count: 0 });

  const where = { storeId: { in: storeIds }, orderCreatedAt: { gte: from, lte: to } };

  const [returBelum, returTotal, mengambang] = await Promise.all([
    prisma.order.count({ where: { ...where, status: OrderStatus.RETUR, returCondition: null } }),
    prisma.order.count({ where: { ...where, status: OrderStatus.RETUR } }),
    prisma.order.aggregate({
      where: { ...where, status: OrderStatus.PENDING_SETTLEMENT },
      _sum: { netSettlement: true },
    }),
  ]);

  const items: AlertItem[] = [];

  if (returBelum > 0) {
    items.push({
      level: "warning",
      title: `${returBelum} retur belum diklasifikasi`,
      detail: "Tandai Bagus / Rusak di halaman Retur & Pembatalan agar kerugian HPP akurat.",
    });
  } else if (returTotal > 0) {
    items.push({
      level: "info",
      title: `${returTotal} pesanan retur pada periode ini`,
      detail: "Semua sudah diklasifikasi.",
    });
  }

  const mengambangTotal = mengambang._sum.netSettlement ?? 0;
  if (mengambangTotal > MENGAMBANG_THRESHOLD) {
    items.push({
      level: "warning",
      title: `Uang mengambang Rp ${Math.round(mengambangTotal).toLocaleString("id-ID")}`,
      detail: `Di atas ambang Rp ${MENGAMBANG_THRESHOLD.toLocaleString("id-ID")}. Cek tab "Uang Mengambang" di Keuangan.`,
    });
  }

  return NextResponse.json({ items, count: items.filter((i) => i.level === "warning").length });
}
