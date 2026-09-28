import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, assertStoreAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// Soft-delete 1 batch Income Report (import salah / duplikat). Entries di dalamnya otomatis
// tidak lagi dipakai reconcile() (lihat filter `import.deletedAt: null` di reconciliation.ts).
// Data mentah TETAP ada di DB untuk audit — tidak di-hard-delete.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const imp = await prisma.incomeImport.findUnique({ where: { id: params.id } });
  if (!imp || imp.deletedAt) return NextResponse.json({ error: "Import tidak ditemukan" }, { status: 404 });

  const storeIds = await assertStoreAccess(user, imp.storeId);
  if (storeIds.length === 0) return NextResponse.json({ error: "Forbidden - toko tidak dikuasakan" }, { status: 403 });

  let reason = "";
  try {
    const body = await req.json();
    reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  } catch {
    // body kosong = ok, reason tetap ""
  }

  // Import non-superseded dengan baris order sudah dipakai reconcile() -> hapus akan
  // mengubah status Cair pesanan-pesanan itu jadi Belum Cair lagi. Wajib alasan.
  const inUse = !imp.isSuperseded && imp.orderRows > 0;
  if (inUse && !reason) {
    return NextResponse.json(
      {
        error: `Import ini dipakai untuk ${imp.orderRows} pesanan di Rekonsiliasi. Menghapusnya akan membuat pesanan itu kembali berstatus Belum Cair — isi alasan untuk melanjutkan.`,
        inUse: true,
      },
      { status: 400 }
    );
  }

  await prisma.incomeImport.update({
    where: { id: imp.id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    actor: user,
    action: "DELETE",
    entityType: "IncomeImport",
    entityId: imp.id,
    entityLabel: imp.fileName,
    storeId: imp.storeId,
    reason: reason || null,
    before: imp,
  });

  return NextResponse.json({ ok: true });
}
