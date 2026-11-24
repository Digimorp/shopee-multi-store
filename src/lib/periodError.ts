import { NextRequest, NextResponse } from "next/server";

/**
 * Parameter `period` di URL tidak valid (bukan YYYY-MM dengan bulan 01-12).
 * Dilempar oleh resolveFilters(); diubah jadi HTTP 400 oleh withPeriodError().
 * Sengaja di file terpisah dari queryFilters.ts (yang mengimpor Prisma) supaya route
 * test yang me-mock "@/lib/queryFilters" tetap memakai pembungkus asli.
 */
export class InvalidPeriodError extends Error {
  readonly status = 400;
  constructor(value: string) {
    super(`Format period harus YYYY-MM (contoh period=2026-08), diterima: "${value}".`);
    this.name = "InvalidPeriodError";
  }
}

/**
 * Bungkus handler route: InvalidPeriodError -> 400 { error: pesan }. Error lain dilempar ulang
 * apa adanya (perilaku lama). Pemakaian: export const GET = withPeriodError(async (req) => { ... });
 */
export function withPeriodError(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof InvalidPeriodError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  };
}
