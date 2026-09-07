import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { returnsSummary } from "@/lib/reports";

// Ringkasan agregat Retur & Pembatalan untuk kartu di halaman /retur-cancel.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const summary = await returnsSummary({ storeIds, from, to });
  return NextResponse.json({ summary });
}
