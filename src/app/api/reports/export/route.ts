import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { getCutoffDay, resolveFilters } from "@/lib/queryFilters";
import { withPeriodError } from "@/lib/periodError";
import { buildReportDataset, datasetToPdfRows, type ReportKey } from "@/lib/reports";
import { buildXlsx } from "@/lib/export";
import { buildTablePdf } from "@/lib/pdf";
import { formatPeriodRangeLabel, getPeriodForMonth, getPeriodMonthForDate } from "@/lib/period";

// Endpoint export tunggal untuk semua laporan.
// GET /api/reports/export?report=<key>&format=xlsx|pdf&storeId&from&to&tab&type
export const GET = withPeriodError(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeIds, from, to } = await resolveFilters(req, user);
  if (storeIds.length === 0 && user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const report = (searchParams.get("report") ?? "orders") as ReportKey;
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const tab = searchParams.get("tab") ?? undefined;
  const type = searchParams.get("type") ?? undefined;

  let ds;
  try {
    ds = await buildReportDataset(report, { storeIds, from, to }, { tab, type });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Gagal membangun laporan" }, { status: 400 });
  }

  const scope = storeIds.length === 1 ? "1 toko" : `${storeIds.length} toko`;
  // T-013 batch 16: nama periode = rentang tanggal ("26 Jun - 25 Jul 2026") dengan cutoff yang sama
  // dengan server. (period yang salah format sudah ditolak resolveFilters di atas.) Link lama from/to
  // -> periode yang memuat tanggal `to` (sama dengan konversi di TopBar).
  const periodParam = searchParams.get("period");
  const hasPeriod = !!periodParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodParam);
  const cutoffDay = await getCutoffDay();
  const periodText = formatPeriodRangeLabel(
    getPeriodForMonth(hasPeriod ? periodParam! : getPeriodMonthForDate(to, cutoffDay), cutoffDay)
  );
  const subtitle = `Periode ${periodText}  -  ${scope}`;
  const stamp = Date.now();
  const safe = report.replace(/[^a-z0-9-]/gi, "");

  if (format === "pdf") {
    const pdf = await buildTablePdf({
      title: ds.title,
      // T-013 temuan QA 4: Rekap tanpa subjudul periode (sama dengan Excel, batch4 H) -- isinya
      // memuat banyak bulan, jadi "Periode <bulan>" menyesatkan.
      subtitle: report === "recap" ? undefined : subtitle,
      columns: ds.columns.map((c) => ({ header: c.header, width: c.width, align: c.align })),
      rows: datasetToPdfRows(ds),
      summary: ds.summary,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-${safe}-${stamp}.pdf"`,
      },
    });
  }

  const xlsx = await buildXlsx(
    ds.title,
    ds.columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(10, c.width * 1.6), kind: c.kind })),
    ds.rows,
    ds.summary,
    // T-013 butir 14: subjudul sama dengan PDF, hanya kalau parameter period ada.
    // Batch4 H: Rekap tidak diberi subjudul — isinya memuat rentang lebih luas dari 1 periode.
    hasPeriod && report !== "recap" ? subtitle : undefined
  );
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-${safe}-${stamp}.xlsx"`,
    },
  });
});
