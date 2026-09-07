import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const storeIds = await assertStoreAccess(user, storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({
    where: { storeId: { in: storeIds } },
    include: { store: { select: { code: true, name: true } } },
    orderBy: [{ storeId: "asc" }, { sku: "asc" }],
  });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const storeIds = await assertStoreAccess(user, body.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!body.sku || !body.name || body.hpp == null || body.catalogPrice == null) {
    return NextResponse.json({ error: "sku, name, hpp, catalogPrice wajib diisi" }, { status: 400 });
  }

  const product = await prisma.product.upsert({
    where: { storeId_sku: { storeId: body.storeId, sku: body.sku } },
    update: { name: body.name, hpp: body.hpp, catalogPrice: body.catalogPrice, isActive: true },
    create: {
      storeId: body.storeId,
      sku: body.sku,
      name: body.name,
      hpp: body.hpp,
      catalogPrice: body.catalogPrice,
    },
  });
  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storeIds = await assertStoreAccess(user, product.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
