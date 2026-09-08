import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import { deriveStage, MATCH_TOLERANCE, FINAL_LOCK_DAYS } from "@/lib/reconciliation";

const now = new Date("2026-09-08T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

function order(over: Partial<Parameters<typeof deriveStage>[0]> = {}) {
  return {
    status: OrderStatus.SELESAI,
    orderCreatedAt: daysAgo(20),
    completedAt: null,
    settlementDate: null,
    ...over,
  } as Parameters<typeof deriveStage>[0];
}

describe("MATCH_TOLERANCE", () => {
  it("Rp 5 (pembulatan)", () => expect(MATCH_TOLERANCE).toBe(5));
});

describe("deriveStage", () => {
  it("TRANSIT tanpa income -> SAMPAI", () => {
    expect(deriveStage(order({ status: OrderStatus.TRANSIT }), null, now)).toBe("SAMPAI");
  });

  it("PENDING/SELESAI tanpa income -> MENUNGGU_CAIR", () => {
    expect(deriveStage(order({ status: OrderStatus.PENDING_SETTLEMENT }), null, now)).toBe("MENUNGGU_CAIR");
    expect(deriveStage(order({ status: OrderStatus.SELESAI }), null, now)).toBe("MENUNGGU_CAIR");
  });

  it("ada income, < H+14 dari settlementDate -> CAIR", () => {
    expect(deriveStage(order({ settlementDate: daysAgo(3) }), { releasedAt: daysAgo(3) }, now)).toBe("CAIR");
  });

  it("ada income, >= H+14 dari settlementDate -> CAIR_FINAL", () => {
    expect(deriveStage(order({ settlementDate: daysAgo(FINAL_LOCK_DAYS + 1) }), { releasedAt: daysAgo(15) }, now)).toBe(
      "CAIR_FINAL"
    );
  });

  it("fallback ref: pakai completedAt kalau settlementDate null", () => {
    expect(deriveStage(order({ completedAt: daysAgo(20) }), { releasedAt: null }, now)).toBe("CAIR_FINAL");
  });

  it("fallback ref: pakai releasedAt income kalau order tak punya tgl", () => {
    expect(deriveStage(order({ orderCreatedAt: daysAgo(2) }), { releasedAt: daysAgo(2) }, now)).toBe("CAIR");
  });
});
