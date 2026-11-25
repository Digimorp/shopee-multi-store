import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { resolveFilters } from "@/lib/queryFilters";
import { withPeriodError } from "@/lib/periodError";
import { reconcile, MATCH_TOLERANCE, FINAL_LOCK_DAYS, STUCK_DAYS } from "@/lib/reconciliation";
import { getUangCairPeriode } from "@/lib/uangCairPeriodeDb";
import { pickRincian } from "@/lib/uangCairPeriode";

// Hasil rekonsiliasi Order (estimasi) vs Income Report (aktual) — per periode per toko.
export const GET = withPeriodError(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [result, uangCairPeriode] = await Promise.all([
    reconcile({ storeIds, from, to }),
    // T-013 batch 13 (tugas X): kartu Uang Cair = semua saldo masuk periode ini (+ rincian).
    getUangCairPeriode({ storeIds, from, to }),
  ]);
  return NextResponse.json({
    ...result,
    uangCairPeriode: pickRincian(uangCairPeriode),
    config: {
      toleransiRp: MATCH_TOLERANCE,
      finalLockDays: FINAL_LOCK_DAYS,
      stuckDays: STUCK_DAYS,
      payoutRatio: result.payoutRatio,
    },
  });
});
