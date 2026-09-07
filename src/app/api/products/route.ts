import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

// Master produk GLOBAL (tidak per toko). Semua user login bisa melihat daftar,
// hanya OWNER yang boleh menambah / mengubah / menonaktifkan.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Hanya Owner yang boleh mengubah master produk" }, { status: 403 });
  }

  const body = await req.json();
  const sku = String(body.sku ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!sku || !name || body.hpp == null || body.catalogPrice == null) {
    return NextResponse.json({ error: "sku, name, hpp, catalogPrice wajib diisi" }, { status: 400 });
  }

  const product = await prisma.product.upsert({
    where: { sku },
    update: { name, hpp: Number(body.hpp), catalogPrice: Number(body.catalogPrice), isActive: true },
    create: { sku, name, hpp: Number(body.hpp), catalogPrice: Number(body.catalogPrice) },
  });
  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Hanya Owner yang boleh mengubah master produk" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
