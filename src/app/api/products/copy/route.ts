import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { LEGACY, canAccessProductStore, resolveWriteStore } from "@/lib/productAccess";
import { logAudit } from "@/lib/audit";

// T-013 batch 21: "Salin dari toko lain" -- salin (sku, nama, HPP, harga katalog) produk AKTIF dari toko
// asal ke toko tujuan. SKU yang sudah ada di tujuan (aktif atau nonaktif) dilewati, tidak ditimpa.
// Kedua toko harus boleh diakses pengguna. Asal "legacy" (produk warisan global) hanya untuk Owner.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = await resolveWriteStore(user, body.toStoreId);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const rawFrom = typeof body.fromStoreId === "string" ? body.fromStoreId.trim() : "";
  if (!rawFrom) return NextResponse.json({ error: "Pilih toko asal (fromStoreId wajib)." }, { status: 400 });
  const fromStoreId = rawFrom === LEGACY ? null : rawFrom;
  if (fromStoreId === target.storeId) return NextResponse.json({ error: "Toko asal dan tujuan sama." }, { status: 400 });
  if (!(await canAccessProductStore(user, fromStoreId))) {
    return NextResponse.json({ error: "Forbidden - toko asal tidak dikuasakan" }, { status: 403 });
  }

  const source = await prisma.product.findMany({
    where: { storeId: fromStoreId, isActive: true },
    select: { sku: true, name: true, hpp: true, catalogPrice: true },
  });
  const existing = new Set(
    (await prisma.product.findMany({ where: { storeId: target.storeId }, select: { sku: true } })).map((p) => p.sku)
  );
  const toCopy = source.filter((p) => !existing.has(p.sku));

  if (toCopy.length > 0) {
    await prisma.product.createMany({
      data: toCopy.map((p) => ({ ...p, storeId: target.storeId })),
      skipDuplicates: true,
    });
    await logAudit({
      actor: user,
      action: "EDIT",
      entityType: "Product",
      entityId: target.storeId,
      entityLabel: `Salin ${toCopy.length} produk dari ${fromStoreId ?? "warisan (global)"}`,
      storeId: target.storeId,
      after: { fromStoreId: fromStoreId ?? LEGACY, toStoreId: target.storeId, skus: toCopy.map((p) => p.sku) },
    });
  }

  return NextResponse.json({ copied: toCopy.length, skipped: source.length - toCopy.length });
}
