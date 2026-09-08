import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { reconcile, MATCH_TOLERANCE, FINAL_LOCK_DAYS, STUCK_DAYS } from "@/lib/reconciliation";

// Hasil rekonsiliasi Order (estimasi) vs Income Report (aktual) — per periode per toko.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await reconcile({ storeIds, from, to });
  return NextResponse.json({
    ...result,
    config: {
      toleransiRp: MATCH_TOLERANCE,
      finalLockDays: FINAL_LOCK_DAYS,
      stuckDays: STUCK_DAYS,
      payoutRatio: result.payoutRatio,
    },
  });
}
