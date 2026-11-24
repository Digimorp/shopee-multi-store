import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/rbac";

/**
 * T-013 nomor 10b: pagar halaman di SERVER (layout). Middleware hanya membaca token cookie
 * (tidak bisa Prisma), jadi user nonaktif / terhapus / turun role baru tertolak di sini.
 * getSessionUser() sudah membaca ulang role, isActive, storeIds dari DB tiap request.
 */

/** Halaman terproteksi: sesi tidak ada / tidak valid -> /login. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Halaman khusus Owner: bukan OWNER (menurut DB, bukan cookie) -> /dashboard. */
export async function requireOwnerPage(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "OWNER") redirect("/dashboard");
  return user;
}
