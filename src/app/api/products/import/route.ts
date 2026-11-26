import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { resolveWriteStore } from "@/lib/productAccess";
import { logPriceChangeIfNeeded } from "@/lib/priceLog";
import { logAudit } from "@/lib/audit";

// T-013 batch 21: import Master SKU ke SATU toko (wajib pilih toko; Owner atau Admin toko itu).
// Format kolom: SKU, Nama Produk, HPP, Harga Katalog. Hasil: baru / diperbarui / dilewati / error.
const HEADERS = { sku: ["SKU", "sku"], name: ["Nama Produk", "name"], hpp: ["HPP", "hpp"], catalog: ["Harga Katalog", "catalogPrice"] };
const pick = (row: any, keys: string[]) => keys.map((k) => row[k]).find((v) => v !== undefined);
const num = (v: unknown) => parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const target = await resolveWriteStore(user, form.get("storeId"));
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file wajib" }, { status: 400 });

  let rows: any[];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  } catch {
    rows = [];
  }
  // Format salah: tidak ada baris, atau kolom SKU / Nama Produk tidak ada di header.
  if (rows.length === 0 || pick(rows[0], HEADERS.sku) === undefined || pick(rows[0], HEADERS.name) === undefined) {
    return NextResponse.json(
      { error: "Format file tidak dikenali. Butuh kolom: SKU, Nama Produk, HPP, Harga Katalog." },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let priceChanges = 0;
  const errors: string[] = [];

  for (const [idx, row] of rows.entries()) {
    const sku = String(pick(row, HEADERS.sku) ?? "").trim();
    const name = String(pick(row, HEADERS.name) ?? "").trim();
    const hpp = num(pick(row, HEADERS.hpp));
    const catalogPrice = num(pick(row, HEADERS.catalog));
    if (!sku || !name || isNaN(hpp) || isNaN(catalogPrice)) {
      errors.push(`Baris ${idx + 2}: data tidak lengkap/valid.`);
      continue;
    }

    const existing = await prisma.product.findUnique({ where: { storeId_sku: { storeId: target.storeId, sku } } });
    if (existing && existing.isActive && existing.name === name && existing.hpp === hpp && existing.catalogPrice === catalogPrice) {
      skipped++; // sama persis -> tidak ada yang diubah
      continue;
    }
    const product = await prisma.product.upsert({
      where: { storeId_sku: { storeId: target.storeId, sku } },
      update: { name, hpp, catalogPrice, isActive: true },
      create: { storeId: target.storeId, sku, name, hpp, catalogPrice },
    });
    if (existing) updated++;
    else created++;

    if (await logPriceChangeIfNeeded({ existing, newHpp: hpp, newCatalog: catalogPrice, changedById: user.id, source: "import" })) {
      priceChanges++;
      // Owner melihat siapa mengubah HPP lewat Log Aktivitas (riwayat harga sudah menyimpan pengubahnya).
      await logAudit({
        actor: user,
        action: "EDIT",
        entityType: "Product",
        entityId: product.id,
        entityLabel: `${sku} - ${name} (import)`,
        storeId: target.storeId,
        before: { name: existing!.name, hpp: existing!.hpp, catalogPrice: existing!.catalogPrice },
        after: { name, hpp, catalogPrice },
      });
    }
  }

  return NextResponse.json({
    storeId: target.storeId,
    created,
    updated,
    skipped,
    failed: errors.length,
    priceChanges,
    errors,
    total: rows.length,
  });
}
