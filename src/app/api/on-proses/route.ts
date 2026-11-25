import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { reconcile } from "@/lib/reconciliation";
import { buildOnProses, onProsesGroupOf } from "@/lib/onProses";

// T-013 batch 15 (D) + 16 (B): pesanan yang uangnya belum masuk, dari SEMUA periode, hanya filter
// Toko (hak akses lewat assertStoreAccess: Admin Toko hanya tokonya). Kelompok "Selesai, belum cair"
// memakai reconcile() Rekonsiliasi apa adanya (BELUM_KETEMU sisi pesanan) -- tidak ada logika cocok
// baru. Rentang = semua waktu. Tanpa schema baru, tanpa rumus baru.
const ALL_TIME = { from: new Date(Date.UTC(2000, 0, 1)), to: new Date(Date.UTC(2100, 0, 1)) };

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeIds = await assertStoreAccess(user, new URL(req.url).searchParams.get("storeId"));
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const recon = await reconcile({ storeIds, ...ALL_TIME });
  const items = recon.items.filter((i) => onProsesGroupOf(i) != null);

  // Omzet Pesanan per pesanan = jumlah grossOmzet baris pesanannya (nilai yang sama dengan laporan).
  const lines = items.length
    ? await prisma.order.findMany({
        where: { storeId: { in: storeIds }, orderSn: { in: items.map((i) => i.orderSn) }, deletedAt: null },
        select: { orderSn: true, grossOmzet: true, store: { select: { code: true } } },
      })
    : [];
  const omzetBySn = new Map<string, number>();
  for (const l of lines) {
    const k = `${l.store?.code ?? "-"}|${l.orderSn}`;
    omzetBySn.set(k, (omzetBySn.get(k) ?? 0) + l.grossOmzet);
  }

  return NextResponse.json(buildOnProses(items, omzetBySn));
}
