import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { canAccessProductStore, productListScope, resolveWriteStore } from "@/lib/productAccess";
import { logPriceChangeIfNeeded } from "@/lib/priceLog";
import { logAudit } from "@/lib/audit";

// T-013 batch 21: Produk & HPP milik TIAP TOKO. Akses lewat src/lib/productAccess.ts:
// Owner = semua toko + produk warisan (storeId NULL); Admin Toko = hanya toko yang dikuasakan.
//   GET    ?storeId=  daftar produk (Owner: kosong/"all" = semua, "legacy" = warisan saja)
//   POST   { storeId, sku, name, hpp, catalogPrice }  tambah produk baru (SKU unik per toko)
//   PUT    { id, name, hpp, catalogPrice }            ubah produk (SKU & toko tidak berubah)
//   DELETE ?id=                                       nonaktifkan produk (bukan hapus permanen)

const DUP_SKU = "SKU sudah ada di toko ini";

function parsePrices(body: any): { hpp: number; catalogPrice: number } | null {
  const hpp = Number(body?.hpp);
  const catalogPrice = Number(body?.catalogPrice);
  if (body?.hpp == null || body?.catalogPrice == null || !Number.isFinite(hpp) || !Number.isFinite(catalogPrice)) return null;
  return { hpp, catalogPrice };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = await productListScope(user, new URL(req.url).searchParams.get("storeId"));
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (scope.empty) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: scope.where,
    orderBy: [{ sku: "asc" }],
    include: { store: { select: { id: true, code: true, name: true } } },
  });
  return NextResponse.json({ products: products.map((p) => ({ ...p, legacy: p.storeId == null })) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = await resolveWriteStore(user, body.storeId);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const sku = String(body.sku ?? "").trim();
  const name = String(body.name ?? "").trim();
  const prices = parsePrices(body);
  if (!sku || !name || !prices) {
    return NextResponse.json({ error: "sku, name, hpp, catalogPrice wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({ where: { storeId_sku: { storeId: target.storeId, sku } } });
  if (existing?.isActive) return NextResponse.json({ error: DUP_SKU }, { status: 409 });

  // SKU yang pernah dihapus (nonaktif) di toko ini dipakai lagi -> diaktifkan dengan nilai baru.
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data: { name, ...prices, isActive: true } })
    : await prisma.product.create({ data: { storeId: target.storeId, sku, name, ...prices } });

  const logged = await logPriceChangeIfNeeded({ existing, newHpp: prices.hpp, newCatalog: prices.catalogPrice, changedById: user.id, source: "manual" });
  await logAudit({
    actor: user,
    action: "EDIT",
    entityType: "Product",
    entityId: product.id,
    entityLabel: `${sku} - ${name}${existing ? " (diaktifkan lagi)" : " (baru)"}`,
    storeId: target.storeId,
    before: existing ? { name: existing.name, hpp: existing.hpp, catalogPrice: existing.catalogPrice, isActive: false } : undefined,
    after: { name, hpp: prices.hpp, catalogPrice: prices.catalogPrice },
  });

  return NextResponse.json({ product, priceChangeLogged: logged });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const existing = await prisma.product.findUnique({ where: { id } });
  // Produk toko lain / warisan untuk Admin: 404 (tidak membocorkan keberadaannya).
  if (!existing || !(await canAccessProductStore(user, existing.storeId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = String(body.name ?? "").trim();
  const prices = parsePrices(body);
  if (!name || !prices) return NextResponse.json({ error: "name, hpp, catalogPrice wajib diisi" }, { status: 400 });

  const product = await prisma.product.update({ where: { id }, data: { name, ...prices, isActive: true } });
  const logged = await logPriceChangeIfNeeded({ existing, newHpp: prices.hpp, newCatalog: prices.catalogPrice, changedById: user.id, source: "manual" });

  if (existing.name !== name || existing.hpp !== prices.hpp || existing.catalogPrice !== prices.catalogPrice) {
    await logAudit({
      actor: user,
      action: "EDIT",
      entityType: "Product",
      entityId: product.id,
      entityLabel: `${existing.sku} - ${name}`,
      storeId: existing.storeId,
      before: { name: existing.name, hpp: existing.hpp, catalogPrice: existing.catalogPrice },
      after: { name, hpp: prices.hpp, catalogPrice: prices.catalogPrice },
    });
  }

  return NextResponse.json({ product, priceChangeLogged: logged });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.isActive || !(await canAccessProductStore(user, product.storeId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.product.update({ where: { id }, data: { isActive: false } });

  await logAudit({
    actor: user,
    action: "DELETE",
    entityType: "Product",
    entityId: product.id,
    entityLabel: `${product.sku} - ${product.name}`,
    storeId: product.storeId,
    before: product,
  });

  return NextResponse.json({ ok: true });
}
