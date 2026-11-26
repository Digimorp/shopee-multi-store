import { assertStoreAccess, type SessionUser } from "@/lib/rbac";

/**
 * T-013 batch 21: akses Produk & HPP per toko. Satu-satunya tempat aturan ini (dipakai semua
 * route /api/products/*). Aturan toko memakai assertStoreAccess yang sudah ada; tidak ditulis ulang.
 *  - Owner      : semua toko aktif + produk warisan (storeId NULL).
 *  - Admin Toko : hanya produk dengan storeId di toko yang dikuasakan; produk warisan tidak.
 * Fail-closed: storeId kosong / "all" / tidak dikenal untuk aksi tulis -> ditolak.
 */

/** Nilai filter khusus untuk produk warisan (storeId NULL). Hanya Owner. */
export const LEGACY = "legacy";

/** Boleh menyentuh (baca/ubah/hapus) produk milik storeId ini? storeId null = produk warisan. */
export async function canAccessProductStore(user: SessionUser, storeId: string | null): Promise<boolean> {
  if (storeId == null) return user.role === "OWNER";
  if (storeId === "all" || storeId === LEGACY || storeId === "") return false;
  const ok = await assertStoreAccess(user, storeId);
  return ok.length === 1 && ok[0] === storeId;
}

/** Toko tujuan untuk aksi tulis (tambah, import, salin-ke). Harus satu toko nyata yang boleh diakses. */
export async function resolveWriteStore(user: SessionUser, raw: unknown): Promise<{ storeId: string } | { error: string; status: number }> {
  const storeId = typeof raw === "string" ? raw.trim() : "";
  if (!storeId || storeId === "all" || storeId === LEGACY) {
    return { error: "Pilih toko dulu (storeId wajib).", status: 400 };
  }
  if (!(await canAccessProductStore(user, storeId))) {
    return { error: "Forbidden - toko tidak dikuasakan", status: 403 };
  }
  return { storeId };
}

export type ProductScope = { where: { storeId?: string | null } | { storeId: { in: string[] } }; empty?: boolean };

/**
 * Filter daftar produk (GET). Hasil = where Prisma untuk kolom storeId, atau error.
 *  - Owner: tanpa filter / "all" -> semua (termasuk warisan); "legacy" -> hanya warisan; storeId -> toko itu.
 *  - Admin: 0 toko -> daftar kosong (bukan error); 1 toko -> otomatis; >1 toko -> storeId wajib salah satunya.
 */
export async function productListScope(user: SessionUser, raw: string | null): Promise<ProductScope | { error: string; status: number }> {
  const storeId = raw?.trim() || null;
  if (user.role === "OWNER") {
    if (!storeId || storeId === "all") return { where: {} };
    if (storeId === LEGACY) return { where: { storeId: null } };
    if (!(await canAccessProductStore(user, storeId))) return { error: "Forbidden - toko tidak dikuasakan", status: 403 };
    return { where: { storeId } };
  }
  const own = await assertStoreAccess(user, "all");
  if (own.length === 0) return { where: { storeId: { in: [] } }, empty: true };
  if (!storeId || storeId === "all") {
    if (own.length === 1) return { where: { storeId: own[0] } };
    return { error: "Pilih toko dulu (storeId wajib, akun ini memegang lebih dari satu toko).", status: 400 };
  }
  if (storeId === LEGACY || !(await canAccessProductStore(user, storeId))) {
    return { error: "Forbidden - toko tidak dikuasakan", status: 403 };
  }
  return { where: { storeId } };
}
