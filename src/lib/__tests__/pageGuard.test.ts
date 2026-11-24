import { describe, it, expect, vi, beforeEach } from "vitest";

// T-013 nomor 10b: pagar halaman di server + signOut sekali di browser.
// Alur asli: cookie token -> authOptions.callbacks.jwt (baca DB) -> session -> getSessionUser -> pageGuard.
// Yang di-mock: Prisma (DB), getServerSession (meniru next-auth), dan redirect (Next melempar NEXT_REDIRECT).
const { userFindUnique, cookieToken, redirect } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  cookieToken: { current: null as any },
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: userFindUnique } } }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn(), useSession: vi.fn() }));
vi.mock("next-auth", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    getServerSession: vi.fn(async (opts: any) => {
      if (!cookieToken.current) return null;
      const token = await opts.callbacks.jwt({ token: { ...cookieToken.current } });
      return opts.callbacks.session({ session: { user: {}, expires: "2099-01-01T00:00:00.000Z" }, token });
    }),
  };
});

import { requirePageUser, requireOwnerPage } from "@/lib/pageGuard";
import { makeInvalidSessionHandler } from "@/components/InvalidSessionGuard";
import UsersLayout from "@/app/(protected)/settings/users/layout";
import StoresLayout from "@/app/(protected)/settings/stores/layout";
import ProductsLayout from "@/app/(protected)/settings/products/layout";
import StatusMappingLayout from "@/app/(protected)/settings/status-mapping/layout";
import PeriodsLayout from "@/app/(protected)/settings/periods/layout";

const OWNER_LAYOUTS = [
  ["/settings/users", UsersLayout],
  ["/settings/stores", StoresLayout],
  ["/settings/products", ProductsLayout],
  ["/settings/status-mapping", StatusMappingLayout],
  ["/settings/periods", PeriodsLayout],
] as const;

const cookie = (role: string) => {
  cookieToken.current = { id: "u1", role, storeIds: [], invalid: false };
};
const db = (role: string, isActive = true) =>
  userFindUnique.mockResolvedValue({ id: "u1", role, isActive, storeAccess: [] });

beforeEach(() => {
  vi.clearAllMocks();
  cookieToken.current = null;
});

describe("(1) halaman terproteksi: sesi invalid -> /login", () => {
  it("tidak login -> /login", async () => {
    await expect(requirePageUser()).rejects.toThrow("NEXT_REDIRECT /login");
  });
  it("user nonaktif (cookie masih ada) -> /login", async () => {
    cookie("ADMIN_TOKO");
    db("ADMIN_TOKO", false);
    await expect(requirePageUser()).rejects.toThrow("NEXT_REDIRECT /login");
  });
  it("user terhapus dari DB -> /login", async () => {
    cookie("OWNER");
    userFindUnique.mockResolvedValue(null);
    await expect(requirePageUser()).rejects.toThrow("NEXT_REDIRECT /login");
  });
  it("admin aktif -> lolos", async () => {
    cookie("ADMIN_TOKO");
    db("ADMIN_TOKO");
    await expect(requirePageUser()).resolves.toMatchObject({ role: "ADMIN_TOKO" });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("(2) halaman khusus Owner: role dari DB, bukan cookie", () => {
  it.each(OWNER_LAYOUTS)("%s: cookie OWNER tapi DB ADMIN_TOKO -> /dashboard", async (_path, Layout) => {
    cookie("OWNER"); // token lama saat masih Owner
    db("ADMIN_TOKO"); // role sudah diturunkan di DB
    await expect((Layout as any)({ children: "isi" })).rejects.toThrow("NEXT_REDIRECT /dashboard");
  });
  it("nonaktif di halaman Owner -> /login (bukan /dashboard)", async () => {
    cookie("OWNER");
    db("OWNER", false);
    await expect(requireOwnerPage()).rejects.toThrow("NEXT_REDIRECT /login");
  });
});

describe("(3) Owner tidak terpengaruh", () => {
  it.each(OWNER_LAYOUTS)("%s: Owner aktif -> isi halaman dirender apa adanya", async (_path, Layout) => {
    cookie("OWNER");
    db("OWNER");
    await expect((Layout as any)({ children: "isi" })).resolves.toBe("isi");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("(4) signOut di browser: sekali saja, tanpa loop", () => {
  it("sesi invalid dilihat berkali-kali -> signOut tepat 1x", () => {
    const signOut = vi.fn();
    const handle = makeInvalidSessionHandler(signOut);
    const invalid = { user: { id: "u1", invalid: true } };
    expect(handle(invalid)).toBe(true);
    expect(handle(invalid)).toBe(false);
    expect(handle({ ...invalid })).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  it("sesi valid / tidak ada sesi (mis. di /login setelah signOut) -> tidak signOut", () => {
    const signOut = vi.fn();
    const handle = makeInvalidSessionHandler(signOut);
    handle(null);
    handle(undefined);
    handle({ user: { id: "u1", role: "OWNER", storeIds: [] } });
    handle({ user: { id: "u1", invalid: false } });
    expect(signOut).not.toHaveBeenCalled();
  });
});
