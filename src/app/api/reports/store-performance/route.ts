import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { storePerformanceRows } from "@/lib/reports";

// Performa per toko untuk halaman /performa-toko.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await storePerformanceRows({ storeIds, from, to });
  return NextResponse.json({ rows });
}
