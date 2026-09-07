import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = (await prisma.periodSetting.findFirst()) ?? (await prisma.periodSetting.create({ data: {} }));
  const locks = await prisma.periodLock.findMany({ orderBy: { periodKey: "desc" } });
  return NextResponse.json({ cutoffDay: setting.cutoffDay, locks });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const setting = await prisma.periodSetting.findFirst();
  if (setting) {
    await prisma.periodSetting.update({ where: { id: setting.id }, data: { cutoffDay: body.cutoffDay } });
  } else {
    await prisma.periodSetting.create({ data: { cutoffDay: body.cutoffDay } });
  }
  return NextResponse.json({ ok: true });
}

// Lock / unlock 1 periode (cegah input data baru numpuk di periode yang udah direkap final)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.periodKey) return NextResponse.json({ error: "periodKey wajib" }, { status: 400 });

  const locked = body.locked ?? true;
  await prisma.periodLock.upsert({
    where: { periodKey: body.periodKey },
    update: { locked, lockedBy: user.id },
    create: { periodKey: body.periodKey, locked, lockedBy: user.id },
  });
  return NextResponse.json({ ok: true });
}
