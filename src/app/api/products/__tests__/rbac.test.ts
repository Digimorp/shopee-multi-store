import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

// T-013 batch 21 (bagian B): Produk & HPP per toko -- akses API.
// assertStoreAccess & getAccessibleStoreIds ASLI (src/lib/rbac.ts) yang dipakai; hanya sesi dan Prisma di-mock.
// Prisma = DB kecil di memori (cukup untuk where storeId / isActive / OR / relasi product).

type P = { id: string; storeId: string | null; sku: string; name: string; hpp: number; catalogPrice: number; isActive: boolean };
const { db, session } = vi.hoisted(() => ({
  db: { products: [] as any[], logs: [] as any[], audits: [] as any[], seq: 0 },
  session: { user: null as any },
}));

function matches(p: any, where: any): boolean {
  if (!where) return true;
  if (where.OR) return where.OR.some((w: any) => matches(p, w));
  for (const [k, v] of Object.entries(where)) {
    if (k === "product") {
      const prod = db.products.find((x) => x.id === p.productId);
      if (!prod || !matches(prod, v)) return false;
    } else if (v && typeof v === "object" && "in" in (v as any)) {
      if (!(v as any).in.includes(p[k])) return false;
    } else if ((p[k] ?? null) !== v) return false;
  }
  return true;
}
const findRow = ({ where }: any) =>
  db.products.find((p) => (where.id ? p.id === where.id : p.storeId === where.storeId_sku.storeId && p.sku === where.storeId_sku.sku)) ?? null;
const create = ({ data }: any) => {
  if (db.products.some((p) => p.storeId === data.storeId && p.sku === data.sku && data.storeId != null)) throw new Error("P2002 unique");
  const p = { id: `p${++db.seq}`, isActive: true, storeId: null, ...data };
  db.products.push(p);
  return { ...p };
};
// Seperti Prisma asli: hasil query = salinan, bukan baris hidup (supaya "existing" tidak ikut berubah).
const findUnique = (a: any) => {
  const r = findRow(a);
  return r ? { ...r } : null;
};
const update = ({ where, data }: any) => ({ ...Object.assign(findRow({ where })!, data) });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findMany: async () => [{ id: "A" }, { id: "B" }, { id: "C" }] }, // toko aktif (Owner)
    product: {
      findMany: async ({ where }: any = {}) => db.products.filter((p) => matches(p, where)).map((p) => ({ ...p, store: null })),
      findUnique: async (a: any) => findUnique(a),
      create: async (a: any) => create(a),
      update: async (a: any) => update(a),
      upsert: async ({ where, update: u, create: c }: any) => (findUnique({ where }) ? update({ where, data: u }) : create({ data: c })),
      createMany: async ({ data }: any) => ({ count: data.map((d: any) => create({ data: d })).length }),
    },
    productPriceLog: {
      create: async ({ data }: any) => db.logs.push({ id: `l${++db.seq}`, ...data, changedBy: { name: data.changedById } }),
      findMany: async ({ where }: any) => db.logs.filter((l) => matches(l, where)),
    },
    auditLog: { create: async ({ data }: any) => db.audits.push(data) },
  },
}));
vi.mock("@/lib/rbac", async (orig) => ({ ...(await orig<any>()), getSessionUser: async () => session.user }));

import { GET, POST, PUT, DELETE } from "@/app/api/products/route";
import { POST as IMPORT } from "@/app/api/products/import/route";
import { POST as COPY } from "@/app/api/products/copy/route";
import { GET as HISTORY } from "@/app/api/products/history/route";

const OWNER = { id: "owner", name: "Owner", email: "o@x", role: "OWNER", storeIds: [] };
const ADMIN_A = { id: "adm-a", name: "Admin A", email: "a@x", role: "ADMIN_TOKO", storeIds: ["A"] };
const ADMIN_AC = { id: "adm-ac", name: "Admin AC", email: "ac@x", role: "ADMIN_TOKO", storeIds: ["A", "C"] };
const ADMIN_NONE = { id: "adm-0", name: "Admin 0", email: "0@x", role: "ADMIN_TOKO", storeIds: [] };

const req = (url: string, body?: any, form?: Record<string, any>) =>
  ({
    url: `http://t${url}`,
    json: async () => body,
    formData: async () => ({ get: (k: string) => form?.[k] ?? null }),
  }) as unknown as NextRequest;
const xlsxFile = (rows: any[]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "S");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return { name: "master.xlsx", arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const textFile = (s: string) => ({ name: "x.csv", arrayBuffer: async () => new TextEncoder().encode(s).buffer });
const status = async (p: Promise<Response>) => (await p).status;
const json = async (p: Promise<Response>) => (await p).json();
const prod = (id: string, storeId: string | null, sku: string, hpp = 1000): P => ({ id, storeId, sku, name: `Produk ${sku}`, hpp, catalogPrice: 5000, isActive: true });
const snapshot = () => JSON.stringify(db.products);

beforeEach(() => {
  db.products = [prod("pa", "A", "SKU-1", 1000), prod("pb", "B", "SKU-1", 2000), prod("pl", null, "SKU-L", 3000)];
  db.logs = [
    { id: "la", productId: "pa", sku: "SKU-1", changedById: "adm-a", changedBy: { name: "Admin A" } },
    { id: "lb", productId: "pb", sku: "SKU-1", changedById: "owner", changedBy: { name: "Owner" } },
  ];
  db.audits = [];
  db.seq = 0;
  session.user = null;
});

describe("tidak login -> 401 di semua route produk", () => {
  it.each([
    ["GET", () => GET(req("/api/products"))],
    ["POST", () => POST(req("/api/products", { storeId: "A", sku: "X", name: "X", hpp: 1, catalogPrice: 1 }))],
    ["PUT", () => PUT(req("/api/products", { id: "pa", name: "X", hpp: 1, catalogPrice: 1 }))],
    ["DELETE", () => DELETE(req("/api/products?id=pa"))],
    ["import", () => IMPORT(req("/api/products/import", undefined, { storeId: "A", file: textFile("SKU\n1") }))],
    ["copy", () => COPY(req("/api/products/copy", { fromStoreId: "B", toStoreId: "A" }))],
    ["history", () => HISTORY(req("/api/products/history"))],
  ])("%s", async (_n, call) => {
    expect(await status(call() as any)).toBe(401);
    expect(db.products).toHaveLength(3);
  });
});

describe("Admin Toko A tidak bisa menyentuh toko B atau produk warisan", () => {
  beforeEach(() => (session.user = ADMIN_A));

  it("GET tanpa storeId (1 toko) -> otomatis hanya produk toko A, tanpa warisan", async () => {
    const d = await json(GET(req("/api/products")));
    expect(d.products.map((p: any) => p.id)).toEqual(["pa"]);
  });
  it("GET toko B / warisan -> 403", async () => {
    expect(await status(GET(req("/api/products?storeId=B")))).toBe(403);
    expect(await status(GET(req("/api/products?storeId=legacy")))).toBe(403);
  });
  it("POST ke toko B -> 403; tanpa toko / ke warisan -> 400; data tidak berubah", async () => {
    const before = snapshot();
    expect(await status(POST(req("/api/products", { storeId: "B", sku: "N", name: "N", hpp: 1, catalogPrice: 1 })))).toBe(403);
    expect(await status(POST(req("/api/products", { sku: "N", name: "N", hpp: 1, catalogPrice: 1 })))).toBe(400);
    expect(await status(POST(req("/api/products", { storeId: "legacy", sku: "N", name: "N", hpp: 1, catalogPrice: 1 })))).toBe(400);
    expect(snapshot()).toBe(before);
  });
  it("PUT / DELETE produk toko B atau warisan -> 404, tidak berubah", async () => {
    const before = snapshot();
    for (const id of ["pb", "pl"]) {
      expect(await status(PUT(req("/api/products", { id, name: "Ubah", hpp: 1, catalogPrice: 1 })))).toBe(404);
      expect(await status(DELETE(req(`/api/products?id=${id}`)))).toBe(404);
    }
    expect(snapshot()).toBe(before);
  });
  it("import ke toko B -> 403", async () => {
    const r = IMPORT(req("/api/products/import", undefined, { storeId: "B", file: xlsxFile([{ SKU: "N", "Nama Produk": "N", HPP: 1, "Harga Katalog": 2 }]) }));
    expect(await status(r)).toBe(403);
    expect(db.products).toHaveLength(3);
  });
  it("salin dari B ke A / dari A ke B / dari warisan -> 403", async () => {
    expect(await status(COPY(req("/api/products/copy", { fromStoreId: "B", toStoreId: "A" })))).toBe(403);
    expect(await status(COPY(req("/api/products/copy", { fromStoreId: "A", toStoreId: "B" })))).toBe(403);
    expect(await status(COPY(req("/api/products/copy", { fromStoreId: "legacy", toStoreId: "A" })))).toBe(403);
    expect(db.products).toHaveLength(3);
  });
  it("riwayat harga hanya toko A", async () => {
    const d = await json(HISTORY(req("/api/products/history")));
    expect(d.logs.map((l: any) => l.id)).toEqual(["la"]);
    expect(await status(HISTORY(req("/api/products/history?storeId=B")))).toBe(403);
  });
  it("PUT produk toko sendiri boleh; riwayat harga mencatat pengubah + audit log", async () => {
    expect(await status(PUT(req("/api/products", { id: "pa", name: "Produk SKU-1", hpp: 1500, catalogPrice: 5000 })))).toBe(200);
    expect(db.products.find((p) => p.id === "pa").hpp).toBe(1500);
    expect(db.products.find((p) => p.id === "pb").hpp).toBe(2000); // toko B tidak ikut berubah
    expect(db.logs.at(-1)).toMatchObject({ productId: "pa", oldHpp: 1000, newHpp: 1500, changedById: "adm-a", source: "manual" });
    expect(db.audits.at(-1)).toMatchObject({ actorId: "adm-a", entityType: "Product", storeId: "A" });
  });
});

describe("Admin dengan beberapa toko / tanpa toko", () => {
  it(">1 toko: GET tanpa storeId -> 400; dengan toko miliknya -> 200", async () => {
    session.user = ADMIN_AC;
    expect(await status(GET(req("/api/products")))).toBe(400);
    expect(await status(GET(req("/api/products?storeId=C")))).toBe(200);
  });
  it("tanpa toko: daftar kosong tanpa error", async () => {
    session.user = ADMIN_NONE;
    const r = await GET(req("/api/products"));
    expect(r.status).toBe(200);
    expect((await r.json()).products).toEqual([]);
  });
});

describe("Owner boleh semua toko + produk warisan", () => {
  beforeEach(() => (session.user = OWNER));
  it("GET semua: termasuk warisan dengan penanda legacy", async () => {
    const d = await json(GET(req("/api/products")));
    expect(d.products.map((p: any) => [p.id, p.legacy])).toEqual([["pa", false], ["pb", false], ["pl", true]]);
    expect((await json(GET(req("/api/products?storeId=legacy")))).products.map((p: any) => p.id)).toEqual(["pl"]);
  });
  it("ubah & hapus produk warisan dan toko B", async () => {
    expect(await status(PUT(req("/api/products", { id: "pl", name: "L", hpp: 9, catalogPrice: 9 })))).toBe(200);
    expect(await status(DELETE(req("/api/products?id=pb")))).toBe(200);
    expect(db.products.find((p) => p.id === "pb").isActive).toBe(false);
  });
});

describe("jalur gagal", () => {
  beforeEach(() => (session.user = OWNER));
  it("SKU dobel di toko yang sama -> 409 'SKU sudah ada di toko ini'", async () => {
    const r = await POST(req("/api/products", { storeId: "A", sku: "SKU-1", name: "Lain", hpp: 1, catalogPrice: 1 }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("SKU sudah ada di toko ini");
  });
  it("SKU sama di toko berbeda -> boleh", async () => {
    expect(await status(POST(req("/api/products", { storeId: "C", sku: "SKU-1", name: "Produk C", hpp: 3000, catalogPrice: 5000 })))).toBe(200);
    expect(db.products.filter((p) => p.sku === "SKU-1").map((p) => [p.storeId, p.hpp])).toEqual([["A", 1000], ["B", 2000], ["C", 3000]]);
  });
  it("import file salah format -> 400, tidak ada yang ditulis", async () => {
    const before = snapshot();
    expect(await status(IMPORT(req("/api/products/import", undefined, { storeId: "A", file: textFile("foo,bar\n1,2") })))).toBe(400);
    expect(await status(IMPORT(req("/api/products/import", undefined, { storeId: "A", file: textFile("") })))).toBe(400);
    expect(await status(IMPORT(req("/api/products/import", undefined, { file: textFile("SKU\n1") })))).toBe(400); // tanpa toko
    expect(snapshot()).toBe(before);
  });
  it("import ke satu toko: baru / diperbarui / dilewati / error; toko lain tidak tersentuh", async () => {
    const file = xlsxFile([
      { SKU: "SKU-1", "Nama Produk": "Produk SKU-1", HPP: 1000, "Harga Katalog": 5000 }, // sama -> dilewati
      { SKU: "SKU-2", "Nama Produk": "Baru", HPP: 700, "Harga Katalog": 2000 }, // baru
      { SKU: "SKU-1", "Nama Produk": "Produk SKU-1", HPP: 1100, "Harga Katalog": 5000 }, // diperbarui
      { SKU: "", "Nama Produk": "Tanpa SKU", HPP: 1, "Harga Katalog": 1 }, // error
    ]);
    const d = await json(IMPORT(req("/api/products/import", undefined, { storeId: "A", file })));
    expect(d).toMatchObject({ created: 1, updated: 1, skipped: 1, failed: 1, priceChanges: 1 });
    expect(db.products.find((p) => p.id === "pb").hpp).toBe(2000);
    expect(db.products.find((p) => p.storeId === "A" && p.sku === "SKU-2")).toBeTruthy();
  });
  it("salin A -> B: SKU yang sudah ada dilewati, sisanya disalin", async () => {
    db.products.push(prod("pa2", "A", "SKU-2", 400));
    const d = await json(COPY(req("/api/products/copy", { fromStoreId: "A", toStoreId: "B" })));
    expect(d).toEqual({ copied: 1, skipped: 1 });
    expect(db.products.find((p) => p.id === "pb").hpp).toBe(2000); // tidak ditimpa
    expect(db.products.find((p) => p.storeId === "B" && p.sku === "SKU-2")?.hpp).toBe(400);
  });
  it("salin ke toko tanpa akses -> 403 (Admin A ke C)", async () => {
    session.user = ADMIN_A;
    expect(await status(COPY(req("/api/products/copy", { fromStoreId: "A", toStoreId: "C" })))).toBe(403);
  });
});
