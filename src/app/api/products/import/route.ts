import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";

// Import master SKU dari Excel. Format kolom: SKU, Nama Produk, HPP, Harga Katalog
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const storeId = form.get("storeId") as string | null;
  if (!file || !storeId) return NextResponse.json({ error: "file dan storeId wajib" }, { status: 400 });

  const storeIds = await assertStoreAccess(user, storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  let success = 0;
  const errors: string[] = [];

  for (const [idx, row] of rows.entries()) {
    const sku = String(row["SKU"] ?? row["sku"] ?? "").trim();
    const name = String(row["Nama Produk"] ?? row["name"] ?? "").trim();
    const hpp = parseFloat(String(row["HPP"] ?? row["hpp"] ?? "0").replace(/[^\d.-]/g, ""));
    const catalogPrice = parseFloat(
      String(row["Harga Katalog"] ?? row["catalogPrice"] ?? "0").replace(/[^\d.-]/g, "")
    );

    if (!sku || !name || isNaN(hpp) || isNaN(catalogPrice)) {
      errors.push(`Baris ${idx + 2}: data tidak lengkap/valid.`);
      continue;
    }

    await prisma.product.upsert({
      where: { storeId_sku: { storeId, sku } },
      update: { name, hpp, catalogPrice, isActive: true },
      create: { storeId, sku, name, hpp, catalogPrice },
    });
    success++;
  }

  return NextResponse.json({ success, failed: errors.length, errors, total: rows.length });
}
