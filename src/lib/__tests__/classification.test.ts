import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import { classifyStatus, normalizeStatus, DEFAULT_STATUS_RULES, type StatusRule } from "@/lib/classification";

describe("normalizeStatus", () => {
  it("trim + lowercase + rapat-kan spasi", () => {
    expect(normalizeStatus("  Pesanan   SELESAI  ")).toBe("pesanan selesai");
  });
  it("null/undefined -> string kosong", () => {
    expect(normalizeStatus(undefined as any)).toBe("");
    expect(normalizeStatus(null as any)).toBe("");
  });
});

describe("classifyStatus dengan aturan default (mirip teks Shopee asli)", () => {
  const cases: [string, OrderStatus][] = [
    ["Selesai", OrderStatus.SELESAI],
    ["Pesanan Selesai", OrderStatus.SELESAI],
    ["Dibatalkan", OrderStatus.CANCEL],
    ["Dibatalkan oleh Pembeli", OrderStatus.CANCEL],
    ["Pengembalian Barang", OrderStatus.RETUR],
    ["Dikembalikan", OrderStatus.RETUR],
    ["Refund Selesai", OrderStatus.RETUR], // 'refund' priority 15 < 'selesai' priority 20
    ["Dikirim", OrderStatus.TRANSIT],
    ["Sedang Dikirim", OrderStatus.TRANSIT],
    ["Perlu Dikirim", OrderStatus.TRANSIT],
    ["Sedang Dikemas", OrderStatus.TRANSIT],
  ];
  it.each(cases)("%s -> %s", (raw, expected) => {
    expect(classifyStatus(raw)).toBe(expected);
  });

  it("case-insensitive", () => {
    expect(classifyStatus("DIBATALKAN")).toBe(OrderStatus.CANCEL);
    expect(classifyStatus("  selesai  ")).toBe(OrderStatus.SELESAI);
  });

  it("status tak dikenal -> fallback TRANSIT", () => {
    expect(classifyStatus("Status Aneh Yang Baru")).toBe(OrderStatus.TRANSIT);
  });

  it("string kosong -> fallback (custom fallback dihormati)", () => {
    expect(classifyStatus("")).toBe(OrderStatus.TRANSIT);
    expect(classifyStatus("   ", DEFAULT_STATUS_RULES, OrderStatus.CANCEL)).toBe(OrderStatus.CANCEL);
  });

  it("DEFAULT_STATUS_RULES konsisten: setiap kategori pakai enum valid & priority angka", () => {
    for (const r of DEFAULT_STATUS_RULES) {
      expect(Object.values(OrderStatus)).toContain(r.category);
      expect(typeof r.priority).toBe("number");
    }
  });
});

describe("classifyStatus dengan aturan custom + priority", () => {
  const rules: StatusRule[] = [
    { pattern: "selesai", category: OrderStatus.SELESAI, priority: 50 },
    { pattern: "selesai retur", category: OrderStatus.RETUR, priority: 10 }, // lebih spesifik, menang
  ];

  it("priority terkecil menang saat beberapa pattern cocok", () => {
    expect(classifyStatus("Pesanan Selesai Retur", rules)).toBe(OrderStatus.RETUR);
  });

  it("hanya pattern longgar yang cocok -> pakai itu", () => {
    expect(classifyStatus("Pesanan Selesai", rules)).toBe(OrderStatus.SELESAI);
  });

  it("aturan kosong -> selalu fallback", () => {
    expect(classifyStatus("Selesai", [])).toBe(OrderStatus.TRANSIT);
  });
});
