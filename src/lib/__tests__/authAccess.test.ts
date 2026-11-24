import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// T-013 nomor 10: akses toko dibaca ulang dari DB tiap request (callback jwt), fail-closed.
// getServerSession di-mock dengan ALUR ASLI next-auth: token cookie -> callbacks.jwt -> callbacks.session.
// authOptions, refreshTokenAccess, getSessionUser, dan route ASLI yang jalan; cuma Prisma yang di-mock.
const { userFindUnique, storeFindMany, cookieToken } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  storeFindMany: vi.fn(),
  cookieToken: { current: null as any },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: userFindUnique }, store: { findMany: storeFindMany } },
}));
vi.mock("next-auth", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    getServerSession: vi.fn(async (opts: any) => {
      if (!cookieToken.current) return null;
      // next-auth menyimpan token hasil jwt() kembali ke cookie; tiru itu supaya request berikutnya memakainya.
      const token = await opts.callbacks.jwt({ token: { ...cookieToken.current } });
      cookieToken.current = token;
      return opts.callbacks.session({
        session: { user: { name: token.name, email: token.email }, expires: "2099-01-01T00:00:00.000Z" },
        token,
      });
    }),
  };
});

import { authOptions, refreshTokenAccess } from "@/lib/auth";
import { getSessionUser } from "@/lib/rbac";
import { GET as storesGET } from "@/app/api/stores/route";
import { GET as profitGET } from "@/app/api/reports/profit/route";

const dbUser = (over: Partial<{ role: string; isActive: boolean; stores: string[] }> = {}) => ({
  id: "u-admin",
  role: over.role ?? "ADMIN_TOKO",
  isActive: over.isActive ?? true,
  storeAccess: (over.stores ?? ["s1"]).map((storeId) => ({ storeId })),
});
const loginAs = (id: string, role: string, storeIds: string[]) => {
  // Token seperti yang dibuat saat login (jwt dengan `user`).
  cookieToken.current = { id, role, storeIds, invalid: false, name: "Nama", email: "x@lokal.test" };
};
const req = (url: string) => ({ url: `http://localhost${url}` }) as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  cookieToken.current = null;
  storeFindMany.mockImplementation((args: any) => {
    const all = [
      { id: "s1", code: "S1", name: "Toko 1", isActive: true },
      { id: "s2", code: "S2", name: "Toko 2", isActive: true },
    ];
    const ids = args?.where?.id?.in;
    return Promise.resolve(ids ? all.filter((s) => ids.includes(s.id)) : all);
  });
});

describe("callback jwt saat login", () => {
  it("dengan `user` (baru login) memakai data authorize(), tanpa query tambahan", async () => {
    const t = await authOptions.callbacks!.jwt!({ token: {}, user: { id: "u1", role: "ADMIN_TOKO", storeIds: ["s1"] } } as any);
    expect(t).toMatchObject({ id: "u1", role: "ADMIN_TOKO", storeIds: ["s1"], invalid: false });
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});

describe("(1) admin dicabut tokonya -> request berikutnya storeIds kosong, tanpa login ulang", () => {
  it("storeIds ikut DB, /api/stores langsung kosong", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(dbUser({ stores: ["s1"] }));
    expect((await getSessionUser())?.storeIds).toEqual(["s1"]);
    expect((await (await storesGET()).json()).stores.map((s: any) => s.id)).toEqual(["s1"]);

    userFindUnique.mockResolvedValue(dbUser({ stores: [] })); // Owner mencabut toko
    expect((await getSessionUser())?.storeIds).toEqual([]);
    expect((await (await storesGET()).json()).stores).toEqual([]);

    userFindUnique.mockResolvedValue(dbUser({ stores: ["s2"] })); // dihubungkan ke toko lain
    expect((await getSessionUser())?.storeIds).toEqual(["s2"]);
  });

  it("1 query ringan per request: select id, role, isActive, storeAccess.storeId", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(dbUser());
    await getSessionUser();
    expect(userFindUnique).toHaveBeenCalledTimes(1);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "u-admin" },
      select: { id: true, role: true, isActive: true, storeAccess: { select: { storeId: true } } },
    });
  });
});

describe("(2) user nonaktif -> getSessionUser() null dan API 401", () => {
  it("langsung ditolak tanpa logout; role & storeIds dihapus dari token", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(dbUser({ isActive: false }));
    expect(await getSessionUser()).toBeNull();
    expect((await storesGET()).status).toBe(401);
    expect((await profitGET(req("/api/reports/profit?period=2026-08&storeId=all"))).status).toBe(401);
    expect(cookieToken.current).toMatchObject({ id: "u-admin", invalid: true });
    expect(cookieToken.current.role).toBeUndefined();
    expect(cookieToken.current.storeIds).toBeUndefined();
  });

  it("diaktifkan lagi -> request berikutnya diterima lagi (token.id disimpan)", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(dbUser({ isActive: false }));
    expect(await getSessionUser()).toBeNull();
    userFindUnique.mockResolvedValue(dbUser({ isActive: true }));
    expect(await getSessionUser()).toMatchObject({ id: "u-admin", role: "ADMIN_TOKO", storeIds: ["s1"] });
  });
});

describe("(3) user dihapus dari database -> null", () => {
  it("findUnique null -> null & 401", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
    expect((await storesGET()).status).toBe(401);
  });

  it("DB error -> fail-closed (null), bukan memakai token lama", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockRejectedValue(new Error("db mati"));
    expect(await getSessionUser()).toBeNull();
  });

  it("token tanpa id -> invalid tanpa query DB", async () => {
    const t = await refreshTokenAccess({ role: "OWNER", storeIds: [] } as any);
    expect(t.invalid).toBe(true);
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});

describe("(4) Owner tidak terpengaruh", () => {
  it("Owner aktif tetap OWNER dan melihat semua toko aktif", async () => {
    loginAs("u-owner", "OWNER", []);
    userFindUnique.mockResolvedValue({ id: "u-owner", role: "OWNER", isActive: true, storeAccess: [] });
    expect(await getSessionUser()).toMatchObject({ id: "u-owner", role: "OWNER", storeIds: [] });
    expect((await (await storesGET()).json()).stores.map((s: any) => s.id)).toEqual(["s1", "s2"]);
  });

  it("role di DB yang berubah ikut terbaca (mis. admin dijadikan Owner)", async () => {
    loginAs("u-admin", "ADMIN_TOKO", ["s1"]);
    userFindUnique.mockResolvedValue(dbUser({ role: "OWNER", stores: [] }));
    expect((await getSessionUser())?.role).toBe("OWNER");
  });
});
