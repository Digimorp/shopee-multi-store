import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

// Log Aktivitas Admin — daftar semua Edit/Delete yang tercatat lewat logAudit().
// OWNER-only: entri global (Product/User/Store/StatusMapping) tidak relevan buat ADMIN_TOKO.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = 50;
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action: action as "EDIT" | "DELETE" } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pageSize });
}
