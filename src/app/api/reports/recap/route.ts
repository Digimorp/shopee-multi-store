import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { OrderStatus } from "@prisma/client";
import { reconcile, buildActualLookup } from "@/lib/reconciliation";
import { buildRecap } from "@/lib/recap";
import { getUangCairPerBulan } from "@/lib/uangCairPeriodeDb";

// type=monthly -> rekap per periode cut-off (26-25), semua bulan, + selisih vs bulan tepat sebelumnya
// type=yearly  -> rekap per tahun (= jumlah 12 bulan periode), multi toko
// Pengelompokan & angka: src/lib/recap.ts (sama persis dengan export datasetRecap).
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "monthly";
  const storeIdParam = searchParams.get("storeId");
  const storeIds = await assertStoreAccess(user, storeIdParam);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await prisma.periodSetting.findFirst();
  const cutoffDay = period?.cutoffDay ?? 25;

  const orders = await prisma.order.findMany({
    where: { storeId: { in: storeIds }, status: { not: OrderStatus.CANCEL }, deletedAt: null },
    select: { orderSn: true, orderCreatedAt: true, grossOmzet: true, netSettlement: true, hppSnapshot: true, qty: true, status: true },
  });

  // Rekap mencakup SEMUA bulan sekaligus (rekap memang lintas bulan; filter periode di halaman
  // tidak membatasi), jadi reconcile() dipanggil dengan rentang seluas mungkin supaya semua order
  // ter-cover pencarian match Income Report. Uang Cair & Profit HPP = nilai AKTUAL (definisi
  // Uang Cair butir 9), sama seperti Laporan Profit & Rekonsiliasi.
  const lookup = buildActualLookup(await reconcile({ storeIds, from: new Date(0), to: new Date() }));
  // T-013 batch 13 (tugas X): kolom Uang Cair = semua saldo masuk per bulan periode (uangCairTotal).
  const { months, years } = buildRecap(orders, lookup, cutoffDay, await getUangCairPerBulan(storeIds, cutoffDay));

  return NextResponse.json({ rows: type === "yearly" ? years : months });
}
