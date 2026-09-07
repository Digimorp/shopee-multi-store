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

/** Ambil session user di server component / route handler. Null kalau belum login. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
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
