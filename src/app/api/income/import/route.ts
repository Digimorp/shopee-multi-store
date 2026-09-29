import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { parseIncomeReportFile } from "@/lib/parseIncomeReport";
import { analyzeUploadAnomalies, type AnomalyRow } from "@/lib/aiAnomalyCheck";
import { Prisma } from "@prisma/client";

// Import Income Report / Laporan Pendapatan Shopee — SATU FILE = SATU TOKO.
// Re-import periode yang sama TIDAK menimpa: import lama yang periodenya overlap
// ditandai isSuperseded, versi baru dibuat. Reconciliation baca import non-superseded.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const storeId = form.get("storeId") as string | null;
  if (!file || !storeId) return NextResponse.json({ error: "file dan storeId wajib" }, { status: 400 });

  const storeIds = await assertStoreAccess(user, storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden - toko tidak dikuasakan" }, { status: 403 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseIncomeReportFile(buffer);

  if (parsed.entries.length === 0) {
    return NextResponse.json(
      {
        error:
          parsed.errors[0]?.message ??
          "Tidak ada baris transaksi terbaca dari Income Report. Cek apakah file benar 'Laporan Saldo / Transaction Report' Shopee.",
        details: parsed.errors,
      },
      { status: 400 }
    );
  }

  // Cari import non-superseded untuk toko ini yang periodenya overlap -> supersede
  let superseded: { id: string; version: number }[] = [];
  if (parsed.periodStart && parsed.periodEnd) {
    superseded = await prisma.incomeImport.findMany({
      where: {
        storeId,
        isSuperseded: false,
        periodStart: { lte: parsed.periodEnd },
        periodEnd: { gte: parsed.periodStart },
      },
      select: { id: true, version: true },
    });
  }

  const nextVersion = superseded.length ? Math.max(...superseded.map((s) => s.version)) + 1 : 1;

  // AI Anomaly Check — dijalankan SETELAH parsing berhasil, SEBELUM entries di-commit ke DB.
  // Fail-open: kalau AI gagal/timeout, proses import di bawah tetap lanjut seperti biasa.
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  const anomalyRows: AnomalyRow[] = parsed.entries.map((e) => ({
    rowRef: e.orderSn ?? "(tanpa No. Pesanan)",
    groupKey: e.type,
    numericValues: { amount: e.amount },
    statusLabel: `${e.type}:${e.direction}`,
    date: e.releasedAt,
  }));
  const periodLabel =
    parsed.periodStart && parsed.periodEnd
      ? `${parsed.periodStart.toISOString().slice(0, 10)} – ${parsed.periodEnd.toISOString().slice(0, 10)}`
      : undefined;
  const aiResult = await analyzeUploadAnomalies(anomalyRows, {
    kind: "income",
    storeName: store ? `${store.code} - ${store.name}` : storeId,
    fileName: file.name,
    periodLabel,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
  });

  const result = await prisma.$transaction(async (tx) => {
    if (superseded.length) {
      await tx.incomeImport.updateMany({
        where: { id: { in: superseded.map((s) => s.id) } },
        data: { isSuperseded: true, supersededAt: new Date() },
      });
    }

    const imp = await tx.incomeImport.create({
      data: {
        storeId,
        uploadedById: user.id,
        fileName: file.name,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        totalRows: parsed.totalRows,
        orderRows: parsed.orderRows,
        adjustmentRows: parsed.adjustmentRows,
        version: nextVersion,
      },
    });

    await tx.incomeEntry.createMany({
      data: parsed.entries.map((e) => ({
        importId: imp.id,
        storeId,
        type: e.type,
        orderSn: e.orderSn,
        adjustmentKind: e.adjustmentKind,
        description: e.description,
        releasedAt: e.releasedAt,
        amount: e.amount,
        raw: (e.raw ?? {}) as Prisma.InputJsonValue,
      })),
    });

    return imp;
  });

  return NextResponse.json({
    importId: result.id,
    version: nextVersion,
    supersededCount: superseded.length,
    orderRows: parsed.orderRows,
    adjustmentRows: parsed.adjustmentRows,
    totalRows: parsed.totalRows,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    parseErrors: parsed.errors.slice(0, 20),
    aiAnomalies: aiResult.anomalies,
    aiCheckSkipped: aiResult.aiCheckSkipped,
    aiSummary: aiResult.summary,
  });
}
