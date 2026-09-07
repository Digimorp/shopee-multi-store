import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getAccessibleStoreIds } from "@/lib/rbac";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessible = await getAccessibleStoreIds(user);
  const stores = await prisma.store.findMany({
    where: { id: { in: accessible } },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ stores });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "code dan name wajib diisi" }, { status: 400 });
  }
  const store = await prisma.store.create({ data: { code: body.code, name: body.name } });
  return NextResponse.json({ store });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const store = await prisma.store.update({
    where: { id: body.id },
    data: { name: body.name, code: body.code, isActive: body.isActive },
  });
  return NextResponse.json({ store });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.store.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
