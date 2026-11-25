import { describe, it, expect } from "vitest";
import { buildOnProses, ageBucket, ageDays } from "@/lib/onProses";

// T-013 batch 15 (bagian D): On Proses = Transit + Belum Cair dari semua periode.
const NOW = new Date("2026-11-25T05:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000 - 3_600_000);
const line = (orderSn: string, status: string, d: number, omzet: number, productName = "P") => ({
  orderSn,
  orderCreatedAt: daysAgo(d),
  storeCode: "T1",
  productName,
  status,
  grossOmzet: omzet,
});

describe("buildOnProses", () => {
  it("hanya Transit & Belum Cair; Selesai/Batal/Retur diabaikan; periode tidak membatasi", () => {
    const r = buildOnProses(
      [
        line("A", "TRANSIT", 1, 10000),
        line("B", "PENDING_SETTLEMENT", 5, 20000),
        line("C", "PENDING_SETTLEMENT", 90, 30000), // 3 bulan lalu tetap muncul
        line("D", "COMPLETED", 2, 99999),
        line("E", "CANCELLED", 2, 99999),
        line("F", "RETURNED", 2, 99999),
      ],
      NOW
    );
    expect(r.rows.map((x) => x.orderSn)).toEqual(["C", "B", "A"]);
    expect(r.summary).toEqual({ count: 3, omzet: 60000, oldestDays: 90 });
  });

  it("pesanan multi-baris digabung: omzet dijumlah, status paling belum selesai", () => {
    const r = buildOnProses([line("M", "PENDING_SETTLEMENT", 2, 15000, "Kaos"), line("M", "TRANSIT", 2, 5000, "Topi")], NOW);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ status: "TRANSIT", omzet: 20000, productName: "Kaos +1 lainnya", bucket: "0-3" });
  });

  it("kelompok status x umur (0-3, 4-7, >7)", () => {
    expect([0, 3, 4, 7, 8].map(ageBucket)).toEqual(["0-3", "0-3", "4-7", "4-7", ">7"]);
    expect(ageDays(daysAgo(0), NOW)).toBe(0);
    const r = buildOnProses([line("A", "TRANSIT", 1, 1), line("B", "TRANSIT", 9, 2), line("C", "PENDING_SETTLEMENT", 5, 4)], NOW);
    const g = Object.fromEntries(r.groups.map((x) => [`${x.status}|${x.bucket}`, x.count]));
    expect(g).toEqual({
      "TRANSIT|0-3": 1, "TRANSIT|4-7": 0, "TRANSIT|>7": 1,
      "PENDING_SETTLEMENT|0-3": 0, "PENDING_SETTLEMENT|4-7": 1, "PENDING_SETTLEMENT|>7": 0,
    });
  });

  it("setelah upload ulang berstatus Selesai, pesanan keluar dari On Proses", () => {
    const sebelum = buildOnProses([line("A", "TRANSIT", 4, 10000)], NOW);
    const sesudah = buildOnProses([line("A", "COMPLETED", 4, 10000)], NOW);
    expect(sebelum.summary.count).toBe(1);
    expect(sesudah.summary).toEqual({ count: 0, omzet: 0, oldestDays: null });
  });
});
