import { NextRequest } from "next/server";
import { SessionUser, assertStoreAccess } from "@/lib/rbac";
import { getDefaultPeriod } from "@/lib/period";

export type ResolvedFilters = {
  storeIds: string[];
  from: Date;
  to: Date;
};

/**
 * Baca query param `storeId`, `from`, `to` dari request, validasi akses toko user,
 * dan fallback ke periode default (26 bulan lalu - 25 bulan ini) kalau tidak diisi.
 */
export async function resolveFilters(req: NextRequest, user: SessionUser): Promise<ResolvedFilters> {
  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get("storeId");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const storeIds = await assertStoreAccess(user, storeIdParam);

  const def = getDefaultPeriod();
  const from = fromParam ? new Date(fromParam) : def.from;
  const to = toParam ? new Date(toParam) : def.to;
  // Set to = akhir hari biar transaksi tgl `to` ikut kehitung
  to.setHours(23, 59, 59, 999);

  return { storeIds, from, to };
}
