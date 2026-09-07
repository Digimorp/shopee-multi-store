import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { OrderStatus } from "@prisma/client";
import { normalizeStatus, DEFAULT_STATUS_RULES } from "@/lib/classification";

const CATEGORIES = Object.values(OrderStatus);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mappings = await prisma.statusMapping.findMany({
    orderBy: [{ priority: "asc" }, { pattern: "asc" }],
  });
  return NextResponse.json({ mappings, defaults: DEFAULT_STATUS_RULES });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const pattern = normalizeStatus(body.pattern ?? "");
  const category = body.category as OrderStatus;
  if (!pattern) return NextResponse.json({ error: "pattern wajib diisi" }, { status: 400 });
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category harus salah satu dari: ${CATEGORIES.join(", ")}` }, { status: 400 });
  }
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100;

  const mapping = await prisma.statusMapping.upsert({
    where: { pattern },
    update: { category, priority, note: body.note ?? null, isActive: true },
    create: { pattern, category, priority, note: body.note ?? null },
  });
  return NextResponse.json({ mapping });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  if (body.category != null && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "category tidak valid" }, { status: 400 });
  }

  const mapping = await prisma.statusMapping.update({
    where: { id: body.id },
    data: {
      category: body.category ?? undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
      note: body.note ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  return NextResponse.json({ mapping });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.statusMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
