import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { logPriceChangeIfNeeded } from "@/lib/priceLog";
import { analyzeUploadAnomalies, type AnomalyRow, type KnownIssue } from "@/lib/aiAnomalyCheck";

// Import master SKU GLOBAL dari Excel. Format kolom: SKU, Nama Produk, HPP, Harga Katalog.
// Hanya OWNER yang boleh import.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Hanya Owner yang boleh import master produk" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file wajib" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  // Parse dulu semua baris (tanpa commit) supaya AI Anomaly Check bisa jalan sebelum upsert.
  const parsedRows = rows.map((row, idx) => {
    const sku = String(row["SKU"] ?? row["sku"] ?? "").trim();
    const name = String(row["Nama Produk"] ?? row["name"] ?? "").trim();
    const hpp = parseFloat(String(row["HPP"] ?? row["hpp"] ?? "0").replace(/[^\d.-]/g, ""));
    const catalogPrice = parseFloat(
      String(row["Harga Katalog"] ?? row["catalogPrice"] ?? "0").replace(/[^\d.-]/g, "")
    );
    const valid = !!sku && !!name && !isNaN(hpp) && !isNaN(catalogPrice);
    return {
      sku,
      name,
      hpp,
      catalogPrice,
      valid,
      errorMsg: valid ? null : `Baris ${idx + 2}: data tidak lengkap/valid.`,
    };
  });

  // AI Anomaly Check — dijalankan SETELAH parsing berhasil, SEBELUM prisma.product.upsert.
  // Fail-open: kalau AI gagal/timeout, proses import di bawah tetap lanjut seperti biasa.
  const anomalyRows: AnomalyRow[] = parsedRows.map((p) => {
    const issues: KnownIssue[] = [];
    if (!p.valid) issues.push({ field: "row", message: p.errorMsg!, severity: "medium" });
    return {
      rowRef: p.sku || p.name || "(baris tidak lengkap)",
      groupKey: p.sku || undefined,
      numericValues: p.valid ? { hpp: p.hpp, catalogPrice: p.catalogPrice } : undefined,
      issues,
    };
  });
  const aiResult = await analyzeUploadAnomalies(anomalyRows, {
    kind: "product",
    storeName: "Global (semua toko)",
    fileName: file.name,
  });

  let success = 0;
  let priceChanges = 0;
  const errors: string[] = [];

  for (const p of parsedRows) {
    if (!p.valid) {
      errors.push(p.errorMsg!);
      continue;
    }

    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name, hpp: p.hpp, catalogPrice: p.catalogPrice, isActive: true },
      create: { sku: p.sku, name: p.name, hpp: p.hpp, catalogPrice: p.catalogPrice },
    });
    if (
      await logPriceChangeIfNeeded({
        existing,
        newHpp: p.hpp,
        newCatalog: p.catalogPrice,
        changedById: user.id,
        source: "import",
      })
    ) {
      priceChanges++;
    }
    success++;
  }

  return NextResponse.json({
    success,
    failed: errors.length,
    priceChanges,
    errors,
    total: rows.length,
    aiAnomalies: aiResult.anomalies,
    aiCheckSkipped: aiResult.aiCheckSkipped,
    aiSummary: aiResult.summary,
  });
}
