import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

// T-013 batch 12 (tugas W): upload pesanan idempoten. Prisma diganti "DB" di memori (mock),
// data lokal tidak disentuh. Route asli + parser di-mock (baris sudah jadi ParsedRow).
const { getSessionUser, assertStoreAccess, parseShopeeFile, db } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  parseShopeeFile: vi.fn(),
  db: {
    orders: [] as any[],
    products: [] as any[],
    locks: new Set<string>(),
    seq: 0,
    findManyCalls: 0,
    lockCalls: 0,
  },
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/parseShopee", () => ({ parseShopeeFile }));
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: async () => ({ cutoffDay: 25 }) },
    statusMapping: { findMany: async () => [] },
    product: { findMany: async () => db.products },
    uploadLog: { create: async () => ({ id: `log-${++db.seq}` }), update: async () => ({}) },
    periodLock: {
      findUnique: async ({ where }: any) => {
        db.lockCalls++;
        return db.locks.has(where.periodKey) ? { periodKey: where.periodKey, locked: true } : null;
      },
    },
    order: {
      findMany: async ({ where }: any) => {
        db.findManyCalls++;
        return db.orders
          .filter((o) => o.storeId === where.storeId && where.orderSn.in.includes(o.orderSn) && o.deletedAt === null)
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
          .map((o) => ({ ...o }));
      },
      create: async ({ data }: any) => {
        const o = { id: `o-${String(++db.seq).padStart(4, "0")}`, createdAt: db.seq, deletedAt: null, updatedById: null, ...data };
        db.orders.push(o);
        return o;
      },
      update: async ({ where, data }: any) => {
        const o = db.orders.find((x) => x.id === where.id);
        Object.assign(o, data);
        return o;
      },
    },
  },
}));

import { POST } from "@/app/api/upload/route";
import { canApplyStatus, lineKey, variationFromRawRow } from "@/lib/uploadUpsert";

const req = () =>
  ({
    formData: async () => ({
      get: (k: string) => (k === "file" ? { name: "p.xlsx", arrayBuffer: async () => new ArrayBuffer(8) } : k === "storeId" ? "store-1" : null),
    }),
  }) as unknown as NextRequest;

type R = Partial<{
  orderSn: string; sku: string; productName: string; variationName: string; status: string;
  pay: number; created: string; completedAt: Date | null;
}>;
const row = (o: R = {}) => ({
  orderSn: o.orderSn ?? "SN-1",
  sku: o.sku ?? "SKU-A",
  skuInduk: "",
  productName: o.productName ?? "Produk A",
  variationName: o.variationName ?? "",
  qty: 1,
  returnedQty: 0,
  unitPrice: o.pay ?? 50000,
  subtotal: o.pay ?? 50000,
  totalPayment: o.pay ?? 50000,
  netSettlementRaw: o.pay ?? 50000,
  adminFee: 0,
  rawStatus: o.status ?? "Selesai",
  settlementColumnPresent: false,
  hasSettlementDate: false,
  orderCreatedAt: new Date(o.created ?? "2026-09-05T03:00:00Z"),
  completedAt: o.completedAt ?? null,
  settlementDate: null,
  raw: { "No. Pesanan": o.orderSn ?? "SN-1", "Nama Variasi": o.variationName ?? "" },
});

async function upload(rows: any[]) {
  parseShopeeFile.mockReturnValue({ rows, errors: [], totalRows: rows.length });
  const res = await POST(req());
  return res.json();
}
const active = () => db.orders.filter((o) => o.deletedAt === null);
const omzet = () => active().reduce((s, o) => s + o.grossOmzet, 0);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db, { orders: [], products: [], locks: new Set<string>(), seq: 0, findManyCalls: 0, lockCalls: 0 });
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
});

describe("upload idempoten", () => {
  it("(a) file yang sama diunggah 2 kali -> jumlah baris tetap, omzet tidak berlipat", async () => {
    const file = [row({ orderSn: "SN-1" }), row({ orderSn: "SN-2", pay: 30000 })];
    const first = await upload(file);
    expect([first.created, first.updated, first.unchanged]).toEqual([2, 0, 0]);
    const second = await upload(file);
    expect([second.created, second.updated, second.unchanged, second.success]).toEqual([0, 0, 2, 0]);
    expect(active()).toHaveLength(2);
    expect(omzet()).toBe(80000);
  });

  it("(b) file kedua berisi pesanan yang sama dengan status lebih maju -> status ter-update", async () => {
    await upload([row({ status: "Perlu Dikirim" })]);
    expect(active()[0].status).toBe(OrderStatus.TRANSIT);
    const done = new Date("2026-09-12T05:00:00Z");
    const r = await upload([row({ status: "Selesai", completedAt: done })]);
    expect([r.created, r.updated]).toEqual([0, 1]);
    expect(active()).toHaveLength(1);
    expect(active()[0].status).toBe(OrderStatus.SELESAI);
    expect(active()[0].completedAt).toEqual(done);
    expect(active()[0].updatedById).toBe("u1");
    expect(active()[0].periodKey).toBe("2026-08-26_2026-09-25"); // tetap dari tanggal pesanan dibuat
  });

  it("(c) file lama dengan status lebih rendah -> tidak menurunkan status", async () => {
    await upload([row({ status: "Selesai" })]);
    const r = await upload([row({ status: "Perlu Dikirim" })]);
    expect([r.created, r.updated, r.unchanged, r.statusKept]).toEqual([0, 0, 1, 1]);
    expect(active()[0].status).toBe(OrderStatus.SELESAI);
    // status akhir tidak saling menimpa; Selesai -> Retur boleh (lebih maju)
    expect(canApplyStatus(OrderStatus.RETUR, OrderStatus.CANCEL)).toBe(false);
    expect(canApplyStatus(OrderStatus.SELESAI, OrderStatus.RETUR)).toBe(true);
    expect(canApplyStatus(OrderStatus.SELESAI, OrderStatus.PENDING_SETTLEMENT)).toBe(false);
  });

  it("(d) pesanan multi-baris: baris berbeda tidak saling menimpa", async () => {
    const file = [
      row({ orderSn: "SN-M", sku: "SKU-A", pay: 10000, status: "Perlu Dikirim" }),
      row({ orderSn: "SN-M", sku: "SKU-B", pay: 20000, status: "Perlu Dikirim" }),
      // tanpa SKU: dibedakan nama + variasi
      row({ orderSn: "SN-M", sku: "", productName: "Buku", variationName: "Merah", pay: 3000, status: "Perlu Dikirim" }),
      row({ orderSn: "SN-M", sku: "", productName: "Buku", variationName: "Biru", pay: 4000, status: "Perlu Dikirim" }),
      // baris identik dalam pesanan yang sama -> dibedakan urutan kemunculan
      row({ orderSn: "SN-M", sku: "SKU-C", pay: 5000, status: "Perlu Dikirim" }),
      row({ orderSn: "SN-M", sku: "SKU-C", pay: 5000, status: "Perlu Dikirim" }),
    ];
    expect((await upload(file)).created).toBe(6);
    const r = await upload(file.map((x) => ({ ...x, rawStatus: "Selesai" })));
    expect([r.created, r.updated]).toEqual([0, 6]);
    expect(active()).toHaveLength(6);
    expect(active().every((o) => o.status === OrderStatus.SELESAI)).toBe(true);
    const by = (sku: string, name = "") => active().filter((o) => o.sku === sku && (!name || o.productName === name));
    expect(by("SKU-A").map((o) => o.grossOmzet)).toEqual([10000]);
    expect(by("SKU-B").map((o) => o.grossOmzet)).toEqual([20000]);
    expect(by("", "Buku").map((o) => o.grossOmzet).sort()).toEqual([3000, 4000]);
    expect(by("SKU-C")).toHaveLength(2);
    expect(omzet()).toBe(10000 + 20000 + 3000 + 4000 + 5000 + 5000);
  });

  it("(e) periode terkunci -> dilewati, baris lama tidak diubah", async () => {
    await upload([row({ status: "Perlu Dikirim" })]);
    db.locks.add("2026-08-26_2026-09-25");
    db.lockCalls = 0;
    const r = await upload([row({ status: "Selesai" }), row({ orderSn: "SN-9" })]);
    expect([r.created, r.updated, r.skippedLocked]).toEqual([0, 0, 2]);
    expect(active()).toHaveLength(1);
    expect(active()[0].status).toBe(OrderStatus.TRANSIT);
    expect(db.lockCalls).toBe(1); // satu query untuk satu periode, bukan per baris
  });

  it("(f) hppSnapshot 0 lalu produk ber-HPP -> snapshot terisi dan profit dihitung ulang; snapshot > 0 tidak diganti", async () => {
    await upload([row()]);
    expect(active()[0].hppSnapshot).toBe(0);
    expect(active()[0].profitHpp).toBe(0);
    db.products = [{ id: "p-a", sku: "SKU-A", name: "Produk A", hpp: 20000, catalogPrice: 60000 }];
    const r = await upload([row()]);
    expect(r.updated).toBe(1);
    expect(active()[0]).toMatchObject({ hppSnapshot: 20000, productId: "p-a", profitHpp: 30000 });
    // HPP master berubah -> snapshot lama dipertahankan, upload ulang = tidak berubah
    db.products = [{ id: "p-a", sku: "SKU-A", name: "Produk A", hpp: 99999, catalogPrice: 60000 }];
    expect((await upload([row()])).unchanged).toBe(1);
    expect(active()[0].hppSnapshot).toBe(20000);
  });

  it("baris lama yang di-soft-delete diabaikan; baris lama diambil dengan satu query", async () => {
    await upload([row()]);
    db.orders[0].deletedAt = new Date();
    db.findManyCalls = 0;
    const r = await upload([row(), row({ orderSn: "SN-2" })]);
    expect(r.created).toBe(2);
    expect(db.findManyCalls).toBe(1);
  });
});

describe("kunci baris", () => {
  it("SKU kalau ada; tanpa SKU -> nama + variasi; variasi baris lama dari rawRow", () => {
    expect(lineKey("SKU-A", "Apa saja", "x")).toBe("sku:sku-a");
    expect(lineKey("", "Buku  Doa", "Merah")).toBe("nama:buku doa|var:merah");
    expect(variationFromRawRow(JSON.stringify({ "Nama Variasi": "Biru" }))).toBe("Biru");
    expect(variationFromRawRow(null)).toBeNull();
    expect(variationFromRawRow("{terpotong")).toBeNull();
  });

  it("baris lama tanpa SKU dan tanpa rawRow -> dicocokkan dengan nama produk (tidak dobel)", async () => {
    db.orders.push({
      id: "o-lama", storeId: "store-1", orderSn: "SN-L", sku: "", productName: "Buku", rawRow: null, qty: 1,
      status: OrderStatus.TRANSIT, productId: null, completedAt: null, settlementDate: null, grossOmzet: 3000,
      netSettlement: 3000, adminFee: 0, hppSnapshot: 0, catalogPriceSnapshot: 0, profitHpp: 0, profitAgen: 0,
      periodKey: "2026-08-26_2026-09-25", createdAt: 0, deletedAt: null,
    });
    const r = await upload([row({ orderSn: "SN-L", sku: "", productName: "Buku", variationName: "Merah", pay: 3000 })]);
    expect([r.created, r.updated]).toEqual([0, 1]);
    expect(active()).toHaveLength(1);
  });
});
