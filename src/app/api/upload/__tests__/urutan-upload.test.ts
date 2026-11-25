import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

// T-013 batch 15 (bagian A): urutan upload (pesanan dulu / income dulu) tidak mengubah hasil.
// Bukti: (1) endpoint pesanan tidak menyentuh tabel income dan sebaliknya; (2) isi DB akhir sama
// persis untuk kedua urutan -> laporan (dihitung saat dibuka dari isi DB) pasti sama.
const { getSessionUser, assertStoreAccess, db, touched } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertStoreAccess: vi.fn(),
  db: { orders: [] as any[], imports: [] as any[], entries: [] as any[], seq: 0 },
  touched: { pesanan: new Set<string>(), income: new Set<string>(), current: "pesanan" as "pesanan" | "income" },
}));

vi.mock("@/lib/rbac", () => ({ getSessionUser, assertStoreAccess }));
vi.mock("@/lib/aiAnomalyCheck", () => ({ analyzeUploadAnomalies: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const models: Record<string, any> = {
    periodSetting: { findFirst: async () => ({ cutoffDay: 25 }) },
    statusMapping: { findMany: async () => [] },
    product: { findMany: async () => [] },
    uploadLog: { create: async () => ({ id: "log" }), update: async () => ({}) },
    periodLock: { findUnique: async () => null },
    order: {
      findMany: async ({ where }: any) => db.orders.filter((o) => where.orderSn.in.includes(o.orderSn)).map((o) => ({ ...o })),
      create: async ({ data }: any) => db.orders.push({ id: `o${++db.seq}`, deletedAt: null, ...data }),
      update: async ({ where, data }: any) => Object.assign(db.orders.find((o) => o.id === where.id), data),
    },
    incomeImport: {
      findMany: async () => [],
      updateMany: async () => ({}),
      create: async ({ data }: any) => {
        const imp = { id: `i${++db.seq}`, ...data };
        db.imports.push(imp);
        return imp;
      },
    },
    incomeEntry: { createMany: async ({ data }: any) => db.entries.push(...data) },
  };
  const proxy: any = new Proxy(
    {},
    {
      get(_, key: string) {
        if (key === "$transaction") return (fn: any) => fn(proxy);
        touched[touched.current].add(key);
        return models[key];
      },
    }
  );
  return { prisma: proxy };
});

import { POST as uploadPesanan } from "@/app/api/upload/route";
import { POST as importIncome } from "@/app/api/income/import/route";

const xlsx = (rows: unknown[][], sheet: string) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
const PESANAN = xlsx(
  [
    ["No. Pesanan", "Status Pesanan", "Nomor Referensi SKU", "Nama Produk", "Jumlah", "Harga Setelah Diskon", "Subtotal Pesanan", "Total Pembayaran", "Waktu Pesanan Dibuat"],
    ["SN-1", "Selesai", "A", "Produk A", 1, 50000, 50000, 50000, "2026-10-01 10:00"],
    ["SN-2", "Sedang Dikirim", "B", "Produk B", 2, 20000, 40000, 40000, "2026-10-02 10:00"],
  ],
  "orders"
);
const INCOME = xlsx(
  [
    ["Tanggal Transaksi", "Tipe Transaksi", "Deskripsi", "No. Pesanan", "Jenis Transaksi", "Jumlah", "Status", "Saldo Akhir"],
    ["2026-10-10 09:00", "Penghasilan dari Pesanan", "", "SN-1", "Transaksi Masuk", 47000, "Selesai", 47000],
    ["2026-10-11 09:00", "Penyesuaian", "Kompensasi", "", "Transaksi Masuk", 1500, "Selesai", 48500],
  ],
  "Transaction Report"
);
const req = (buf: Buffer) =>
  ({
    formData: async () => ({
      get: (k: string) => (k === "file" ? { name: "f.xlsx", arrayBuffer: async () => buf } : k === "storeId" ? "store-1" : null),
    }),
  }) as unknown as NextRequest;

async function run(order: ("pesanan" | "income")[]) {
  Object.assign(db, { orders: [], imports: [], entries: [], seq: 0 });
  for (const step of order) {
    touched.current = step;
    const res = step === "pesanan" ? await uploadPesanan(req(PESANAN)) : await importIncome(req(INCOME));
    expect(res.status).toBe(200);
  }
  const strip = (rows: any[]) => rows.map(({ id, importId, uploadLogId, ...r }) => r);
  return { orders: strip(db.orders), entries: strip(db.entries), imports: strip(db.imports) };
}

beforeEach(() => {
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER", storeIds: [] });
  assertStoreAccess.mockResolvedValue(["store-1"]);
});

describe("urutan upload pesanan vs income", () => {
  it("isi DB akhir sama untuk pesanan->income dan income->pesanan; tabel tidak saling disentuh", async () => {
    const a = await run(["pesanan", "income"]);
    const b = await run(["income", "pesanan"]);
    expect(a.orders).toHaveLength(2);
    expect(a.entries).toHaveLength(2);
    expect(b).toEqual(a);
    expect([...touched.pesanan].filter((m) => m.startsWith("income"))).toEqual([]);
    expect([...touched.income].filter((m) => m === "order" || m === "uploadLog")).toEqual([]);
  });
});
