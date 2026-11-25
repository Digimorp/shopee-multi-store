import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

// T-013 batch 14 (tugas Y): omzet pesanan multi-baris tidak boleh dobel. File xlsx sintetis dibuat di
// test ini, parser ASLI jalan; Prisma diganti DB di memori (data lokal tidak disentuh).
const { getSessionUser, assertStoreAccess, db } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  db: { orders: [] as any[], seq: 0, file: null as Buffer | null },
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodSetting: { findFirst: async () => ({ cutoffDay: 25 }) },
    statusMapping: { findMany: async () => [] },
    product: { findMany: async () => [] },
    uploadLog: { create: async () => ({ id: `log-${++db.seq}` }), update: async () => ({}) },
    periodLock: { findUnique: async () => null },
    order: {
      findMany: async ({ where }: any) =>
        db.orders
          .filter((o) => o.storeId === where.storeId && where.orderSn.in.includes(o.orderSn) && o.deletedAt === null)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((o) => ({ ...o })),
      create: async ({ data }: any) => {
        const o = { id: `o-${++db.seq}`, createdAt: db.seq, deletedAt: null, ...data };
        db.orders.push(o);
        return o;
      },
      update: async ({ where, data }: any) => Object.assign(db.orders.find((x) => x.id === where.id), data),
    },
  },
}));

import { POST } from "@/app/api/upload/route";
import { parseShopeeFile } from "@/lib/parseShopee";
import { lineOmzet } from "@/lib/uploadUpsert";

const HEAD = ["No. Pesanan", "Status Pesanan", "Nomor Referensi SKU", "Nama Produk", "Jumlah", "Harga Setelah Diskon", "Subtotal Pesanan", "Total Pembayaran", "Waktu Pesanan Dibuat"];
type L = [sn: string, status: string, sku: string, qty: number, price: number, subtotal: number | "", total: number];
const xlsx = (lines: L[]) => {
  const aoa = [HEAD, ...lines.map(([sn, st, sku, qty, price, sub, tot]) => [sn, st, sku, `Produk ${sku}`, qty, price, sub, tot, "2026-10-01 10:00"])];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "orders");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
// Contoh nyata dari temuan: 2609262QC0YV3H, 3 baris, Total Pembayaran 308.760 diulang, subtotal tiap baris 101.000.
const MULTI: L[] = [
  ["2609262QC0YV3H", "Selesai", "SKU-A", 1, 101000, 101000, 308760],
  ["2609262QC0YV3H", "Selesai", "SKU-B", 1, 101000, 101000, 308760],
  ["2609262QC0YV3H", "Selesai", "SKU-C", 1, 101000, 101000, 308760],
];
const SINGLE: L = ["SN-SATU", "Selesai", "SKU-D", 2, 45000, 90000, 90000];
const BATAL: L = ["SN-BATAL", "Batal", "SKU-E", 1, 50000, 50000, 50000];

const req = () =>
  ({
    formData: async () => ({
      get: (k: string) =>
        k === "file" ? { name: "Order.all.xlsx", arrayBuffer: async () => db.file! } : k === "storeId" ? "store-1" : null,
    }),
  }) as unknown as NextRequest;
const upload = async (lines: L[]) => {
  db.file = xlsx(lines);
  return (await POST(req())).json();
};
const omzetOf = (sn: string) => db.orders.filter((o) => o.orderSn === sn).reduce((s, o) => s + o.grossOmzet, 0);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db, { orders: [], seq: 0, file: null });
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
});

describe("omzet pesanan multi-baris", () => {
  it("(a) pesanan 3 baris -> omzet = jumlah subtotal baris (303.000), bukan 3 x Total Pembayaran", async () => {
    const r = await upload([...MULTI, SINGLE]);
    expect(r.created).toBe(4);
    expect(db.orders.filter((o) => o.orderSn === "2609262QC0YV3H").map((o) => o.grossOmzet)).toEqual([101000, 101000, 101000]);
    expect(omzetOf("2609262QC0YV3H")).toBe(303000);
    expect(omzetOf("2609262QC0YV3H")).not.toBe(3 * 308760);
  });

  it("(b) pesanan 1 baris tidak berubah (Subtotal = Total Pembayaran)", async () => {
    await upload([SINGLE]);
    expect(omzetOf("SN-SATU")).toBe(90000);
  });

  it("(c) Batal -> omzet 0", async () => {
    await upload([BATAL]);
    expect(omzetOf("SN-BATAL")).toBe(0);
  });

  it("(d) upload ulang file lama memperbaiki baris yang tersimpan dengan rumus lama (3 x 308.760)", async () => {
    await upload(MULTI);
    for (const o of db.orders) o.grossOmzet = 308760; // keadaan sebelum batch 14
    expect(omzetOf("2609262QC0YV3H")).toBe(926280);
    const r = await upload(MULTI);
    expect([r.created, r.updated]).toEqual([0, 3]);
    expect(db.orders).toHaveLength(3);
    expect(omzetOf("2609262QC0YV3H")).toBe(303000);
  });

  it("cadangan omzet baris: Subtotal kosong -> Harga x Jumlah, bukan Total Pembayaran", async () => {
    const { rows } = parseShopeeFile(xlsx([["SN-X", "Selesai", "SKU-F", 3, 20000, "", 999999]]));
    expect(rows[0].subtotal).toBe(0);
    expect(lineOmzet(rows[0])).toBe(60000);
    expect(lineOmzet({ subtotal: 0, unitPrice: 0, qty: 2 })).toBe(0);
  });

  it("adminFee & estimasi cair: dihitung sekali per pesanan, tidak membengkak di multi-baris", () => {
    const { rows } = parseShopeeFile(xlsx([...MULTI, ["SN-ONG", "Selesai", "SKU-G", 1, 50000, 50000, 62000]]));
    const multi = rows.filter((r) => r.orderSn === "2609262QC0YV3H");
    expect(multi.map((r) => r.netSettlementRaw)).toEqual([101000, 101000, 101000]);
    // dulu tiap baris 308.760 - 101.000 = 207.760 (total 623.280); sekarang 5.760 dibagi 3
    expect(multi.reduce((s, r) => s + r.adminFee, 0)).toBeCloseTo(5760, 6);
    expect(multi[0].adminFee).toBeCloseTo(1920, 6);
    // pesanan 1 baris: rumus lama tetap (62.000 - 50.000)
    expect(rows.find((r) => r.orderSn === "SN-ONG")!.adminFee).toBe(12000);
  });
});
