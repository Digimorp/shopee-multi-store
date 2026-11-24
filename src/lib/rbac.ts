import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN_TOKO";
  storeIds: string[];
};

/**
 * Ambil session user di server component / route handler. FAIL-CLOSED: null kalau belum login,
 * token ditandai tidak valid (user nonaktif / terhapus / DB gagal -- lihat refreshTokenAccess),
 * atau id / role / storeIds tidak lengkap. Tidak pernah mengembalikan user setengah jadi.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u || u.invalid) return null;
  if (typeof u.id !== "string" || !u.id) return null;
  if (u.role !== "OWNER" && u.role !== "ADMIN_TOKO") return null;
  if (!Array.isArray(u.storeIds)) return null;
  return { id: u.id, name: u.name ?? "", email: u.email ?? "", role: u.role, storeIds: u.storeIds };
}

/** Daftar storeId yang boleh diakses user. Owner = semua toko aktif. */
export async function getAccessibleStoreIds(user: SessionUser): Promise<string[]> {
  if (user.role === "OWNER") {
    const stores = await prisma.store.findMany({ where: { isActive: true }, select: { id: true } });
    return stores.map((s) => s.id);
  }
  return user.storeIds;
}

/** Validasi 1 storeId (dari query filter) boleh diakses user. Return storeId yang valid, atau null kalau tidak berhak. */
export async function assertStoreAccess(user: SessionUser, storeId: string | null): Promise<string[]> {
  const accessible = await getAccessibleStoreIds(user);
  if (!storeId || storeId === "all") return accessible;
  if (!accessible.includes(storeId)) return [];
  return [storeId];
}
