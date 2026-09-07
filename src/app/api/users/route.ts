import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: { storeAccess: { include: { store: { select: { id: true, code: true, name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      stores: u.storeAccess.map((sa) => sa.store),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.email || !body.password || !body.role) {
    return NextResponse.json({ error: "name, email, password, role wajib diisi" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const created = await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash, role: body.role },
  });

  const storeIds: string[] = body.storeIds ?? [];
  for (const storeId of storeIds) {
    await prisma.userStore.create({ data: { userId: created.id, storeId } });
  }

  return NextResponse.json({ user: created });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const data: any = { name: body.name, role: body.role, isActive: body.isActive };
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

  await prisma.user.update({ where: { id: body.id }, data });

  if (Array.isArray(body.storeIds)) {
    await prisma.userStore.deleteMany({ where: { userId: body.id } });
    for (const storeId of body.storeIds as string[]) {
      await prisma.userStore.create({ data: { userId: body.id, storeId } });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
