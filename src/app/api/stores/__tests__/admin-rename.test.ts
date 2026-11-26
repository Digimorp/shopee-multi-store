import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// T-013 batch 21 (bagian B/D): Admin Toko boleh mengubah NAMA TAMPILAN toko miliknya saja.
// Kode, status aktif, tambah & hapus toko tetap Owner. assertStoreAccess asli; sesi + Prisma di-mock.
const { stores, session } = vi.hoisted(() => ({ stores: {} as Record<string, any>, session: { user: null as any } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: {
      findMany: async () => Object.values(stores).map((s: any) => ({ id: s.id })),
      findUnique: async ({ where }: any) => (stores[where.id] ? { ...stores[where.id] } : null),
      update: async ({ where, data }: any) => ({ ...Object.assign(stores[where.id], data) }),
      create: async ({ data }: any) => data,
    },
    auditLog: { create: async () => ({}) },
  },
}));
vi.mock("@/lib/rbac", async (orig) => ({ ...(await orig<any>()), getSessionUser: async () => session.user }));

import { POST, PUT, DELETE } from "@/app/api/stores/route";

const ADMIN_A = { id: "a", name: "A", email: "a@x", role: "ADMIN_TOKO", storeIds: ["A"] };
const req = (body: any, url = "http://t/api/stores") => ({ url, json: async () => body }) as unknown as NextRequest;

beforeEach(() => {
  stores.A = { id: "A", code: "TOKO-A", name: "Toko A", isActive: true };
  stores.B = { id: "B", code: "TOKO-B", name: "Toko B", isActive: true };
  session.user = ADMIN_A;
});

describe("Admin Toko & toko", () => {
  it("ubah nama toko sendiri -> 200; kode & status tidak ikut berubah", async () => {
    const r = await PUT(req({ id: "A", name: "Toko A Baru", code: "HACK", isActive: false }));
    expect(r.status).toBe(200);
    expect(stores.A).toEqual({ id: "A", code: "TOKO-A", name: "Toko A Baru", isActive: true });
  });
  it("ubah toko lain -> 403, tidak berubah", async () => {
    expect((await PUT(req({ id: "B", name: "X" }))).status).toBe(403);
    expect(stores.B.name).toBe("Toko B");
  });
  it("nama kosong -> 400", async () => {
    expect((await PUT(req({ id: "A", name: "  " }))).status).toBe(400);
  });
  it("tambah / hapus toko tetap Owner -> 403", async () => {
    expect((await POST(req({ code: "N", name: "N" }))).status).toBe(403);
    expect((await DELETE(req({}, "http://t/api/stores?id=A"))).status).toBe(403);
    expect(stores.A.isActive).toBe(true);
  });
  it("tidak login -> 401", async () => {
    session.user = null;
    expect((await PUT(req({ id: "A", name: "X" }))).status).toBe(401);
  });
});
