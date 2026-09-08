import { describe, it, expect, vi, beforeEach } from "vitest";

// --- mock dependency berat sebelum import modul rbac ---
// vi.hoisted: fn dibuat sebelum vi.mock di-hoist, jadi aman dipakai di factory.
const { findMany, getServerSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { store: { findMany } } }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession }));

import { getSessionUser, getAccessibleStoreIds, assertStoreAccess, type SessionUser } from "@/lib/rbac";

const owner: SessionUser = { id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] };
const admin: SessionUser = { id: "u2", name: "Admin", email: "a@x.com", role: "ADMIN_TOKO", storeIds: ["s1", "s2"] };

beforeEach(() => {
  findMany.mockReset();
  getServerSession.mockReset();
});

describe("getSessionUser", () => {
  it("null kalau tidak ada session", async () => {
    getServerSession.mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });
  it("null kalau session tanpa user", async () => {
    getServerSession.mockResolvedValue({});
    expect(await getSessionUser()).toBeNull();
  });
  it("kembalikan user kalau ada", async () => {
    getServerSession.mockResolvedValue({ user: owner });
    expect(await getSessionUser()).toEqual(owner);
  });
});

describe("getAccessibleStoreIds", () => {
  it("OWNER -> semua toko AKTIF dari DB", async () => {
    findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    expect(await getAccessibleStoreIds(owner)).toEqual(["s1", "s2", "s3"]);
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, select: { id: true } });
  });

  it("ADMIN_TOKO -> storeIds miliknya, tanpa query DB", async () => {
    expect(await getAccessibleStoreIds(admin)).toEqual(["s1", "s2"]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("assertStoreAccess", () => {
  it("'all' / null -> semua toko yang boleh diakses", async () => {
    findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    expect(await assertStoreAccess(owner, "all")).toEqual(["s1", "s2"]);
    expect(await assertStoreAccess(admin, null)).toEqual(["s1", "s2"]);
  });

  it("ADMIN minta toko yang dia pegang -> lolos", async () => {
    expect(await assertStoreAccess(admin, "s1")).toEqual(["s1"]);
  });

  it("ADMIN minta toko yang BUKAN miliknya -> [] (forbidden)", async () => {
    expect(await assertStoreAccess(admin, "s9")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("OWNER minta 1 toko aktif -> [storeId]", async () => {
    findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    expect(await assertStoreAccess(owner, "s2")).toEqual(["s2"]);
  });

  it("OWNER minta toko nonaktif (tak ada di list aktif) -> []", async () => {
    findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    expect(await assertStoreAccess(owner, "s-nonaktif")).toEqual([]);
  });
});
