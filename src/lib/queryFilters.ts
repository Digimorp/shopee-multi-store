import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionUser, assertStoreAccess } from "@/lib/rbac";
import { getDefaultPeriod, getPeriodForMonth, getCurrentPeriodMonth } from "@/lib/period";

export type ResolvedFilters = {
  storeIds: string[];
  from: Date;
  to: Date;
};

/**
 * Parameter `period` di URL tidak valid. Membawa status 400 + pesan yang bisa langsung
 * ditampilkan ke pengguna. CATATAN: route pemanggil belum menangkap error ini, jadi
 * saat ini Next.js membalasnya sebagai 500 — lihat laporan T-013 langkah 2.
 */
export class InvalidPeriodError extends Error {
  readonly status = 400;
  constructor(value: string) {
    super(`Parameter period tidak valid: "${value}". Format yang benar YYYY-MM, contoh period=2027-01.`);
    this.name = "InvalidPeriodError";
  }
}

const PERIOD_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;

// getCurrentPeriodMonth dipindah ke src/lib/period.ts (tanpa perubahan perilaku) supaya bisa
// dipakai juga di browser (TopBar) — file ini mengimpor Prisma, jadi tidak boleh masuk bundle client.
// Tetap diekspor ulang dari sini untuk pemanggil lama.
export { getCurrentPeriodMonth };

async function getCutoffDay(): Promise<number> {
  const setting = await prisma.periodSetting.findFirst();
  return setting?.cutoffDay ?? 25;
}

/**
 * Baca query param `storeId` dan filter waktu dari request, validasi akses toko user.
 * Urutan filter waktu:
 *  1. `period=YYYY-MM` -> periode cut-off bulan itu dalam WIB (cutoffDay dari PeriodSetting, default 25).
 *     Format salah -> lempar InvalidPeriodError (status 400).
 *  2. Tidak ada `period` tapi ada `from`/`to` -> perilaku lama, tidak berubah (link lama tetap jalan).
 *  3. Tidak ada keduanya -> periode cut-off yang sedang berjalan dalam WIB.
 * `period=` kosong diperlakukan sama dengan tidak ada.
 */
export async function resolveFilters(req: NextRequest, user: SessionUser): Promise<ResolvedFilters> {
  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get("storeId");
  const periodParam = searchParams.get("period");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const storeIds = await assertStoreAccess(user, storeIdParam);

  // 1. period=YYYY-MM
  if (periodParam) {
    if (!PERIOD_PARAM.test(periodParam)) throw new InvalidPeriodError(periodParam);
    const { from, to } = getPeriodForMonth(periodParam, await getCutoffDay());
    return { storeIds, from, to };
  }

  // 2. Link lama from/to — perilaku persis seperti sebelumnya.
  if (fromParam || toParam) {
    const def = getDefaultPeriod();
    const from = fromParam ? new Date(fromParam) : def.from;
    const to = toParam ? new Date(toParam) : def.to;
    // Set to = akhir hari biar transaksi tgl `to` ikut kehitung
    to.setHours(23, 59, 59, 999);
    return { storeIds, from, to };
  }

  // 3. Default: periode cut-off berjalan dalam WIB.
  const cutoffDay = await getCutoffDay();
  const { from, to } = getPeriodForMonth(getCurrentPeriodMonth(cutoffDay), cutoffDay);
  return { storeIds, from, to };
}
