import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const { periodSettingFindFirst, assertStoreAccess } = vi.hoisted(() => ({
  periodSettingFindFirst: vi.fn(),
  assertStoreAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { periodSetting: { findFirst: periodSettingFindFirst } } }));
vi.mock("@/lib/rbac", () => ({ assertStoreAccess }));

import { resolveFilters, InvalidPeriodError, getCurrentPeriodMonth } from "@/lib/queryFilters";
import { getDefaultPeriod } from "@/lib/period";

const user = { id: "u1", name: "Owner", email: "o@x.com", role: "OWNER", storeIds: [] } as any;
const req = (qs: string) => ({ url: `http://localhost/api/reports/profit?${qs}` }) as unknown as NextRequest;
const wib = (s: string) => new Date(`${s}+07:00`);

beforeEach(() => {
  vi.clearAllMocks();
  assertStoreAccess.mockResolvedValue(["store-1"]);
  periodSettingFindFirst.mockResolvedValue({ cutoffDay: 25 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("resolveFilters — 1. period=YYYY-MM", () => {
  it("dihitung dengan getPeriodForMonth + cutoffDay dari PeriodSetting", async () => {
    const r = await resolveFilters(req("storeId=store-1&period=2027-01"), user);
    expect(r.storeIds).toEqual(["store-1"]);
    expect(r.from.toISOString()).toBe("2026-12-25T17:00:00.000Z"); // 26 Des 2026 00:00 WIB
    expect(r.to.toISOString()).toBe("2027-01-25T16:59:59.999Z"); // 25 Jan 2027 23:59:59.999 WIB
    expect(periodSettingFindFirst).toHaveBeenCalledTimes(1);
  });

  it("cutoffDay lain dari PeriodSetting ikut dipakai", async () => {
    periodSettingFindFirst.mockResolvedValue({ cutoffDay: 20 });
    const r = await resolveFilters(req("period=2027-01"), user);
    expect(r.from.getTime()).toBe(wib("2026-12-21T00:00:00.000").getTime());
    expect(r.to.getTime()).toBe(wib("2027-01-20T23:59:59.999").getTime());
  });

  it("PeriodSetting kosong -> default cutoff 25", async () => {
    periodSettingFindFirst.mockResolvedValue(null);
    const r = await resolveFilters(req("period=2027-02"), user);
    expect(r.from.getTime()).toBe(wib("2027-01-26T00:00:00.000").getTime());
    expect(r.to.getTime()).toBe(wib("2027-02-25T23:59:59.999").getTime());
  });

  it("period menang atas from/to kalau keduanya ada", async () => {
    const r = await resolveFilters(req("period=2027-01&from=2020-01-01&to=2020-01-31"), user);
    expect(r.from.toISOString()).toBe("2026-12-25T17:00:00.000Z");
  });
});

describe("resolveFilters — 2. link lama from/to (tanpa period)", () => {
  it("perilaku persis seperti sebelumnya, PeriodSetting tidak dibaca", async () => {
    const r = await resolveFilters(req("from=2026-09-01&to=2026-09-30"), user);
    const expectedTo = new Date("2026-09-30");
    expectedTo.setHours(23, 59, 59, 999);
    expect(r.from.getTime()).toBe(new Date("2026-09-01").getTime());
    expect(r.to.getTime()).toBe(expectedTo.getTime());
    expect(periodSettingFindFirst).not.toHaveBeenCalled();
  });

  it("hanya from -> sisi to pakai default lama (getDefaultPeriod), sama seperti sebelumnya", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    const r = await resolveFilters(req("from=2026-11-01"), user);
    const expectedTo = getDefaultPeriod().to;
    expectedTo.setHours(23, 59, 59, 999);
    expect(r.from.getTime()).toBe(new Date("2026-11-01").getTime());
    expect(r.to.getTime()).toBe(expectedTo.getTime());
  });
});

describe("resolveFilters — 3. tanpa period dan tanpa from/to -> periode berjalan dalam WIB", () => {
  it("24 Nov 2026 WIB -> periode November 2026 (26 Okt - 25 Nov)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(wib("2026-11-24T10:00:00"));
    const r = await resolveFilters(req("storeId=store-1"), user);
    expect(r.from.getTime()).toBe(wib("2026-10-26T00:00:00.000").getTime());
    expect(r.to.getTime()).toBe(wib("2026-11-25T23:59:59.999").getTime());
  });

  it("26 Nov 2026 jam 00:30 WIB (masih 25 Nov di UTC) -> sudah periode Desember 2026", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(wib("2026-11-26T00:30:00"));
    const r = await resolveFilters(req(""), user);
    expect(r.from.getTime()).toBe(wib("2026-11-26T00:00:00.000").getTime());
    expect(r.to.getTime()).toBe(wib("2026-12-25T23:59:59.999").getTime());
  });

  it("period= kosong diperlakukan sama dengan tidak ada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(wib("2026-11-24T10:00:00"));
    const r = await resolveFilters(req("period="), user);
    expect(r.to.getTime()).toBe(wib("2026-11-25T23:59:59.999").getTime());
  });

  it("getCurrentPeriodMonth: batas cut-off & pergantian tahun", () => {
    expect(getCurrentPeriodMonth(25, wib("2027-01-25T23:59:59.999"))).toBe("2027-01");
    expect(getCurrentPeriodMonth(25, wib("2027-01-26T00:00:00.000"))).toBe("2027-02");
    expect(getCurrentPeriodMonth(25, wib("2026-12-26T00:00:00.000"))).toBe("2027-01");
    expect(getCurrentPeriodMonth(30, wib("2027-02-28T23:59:59.999"))).toBe("2027-02");
    expect(getCurrentPeriodMonth(30, wib("2027-03-01T00:00:00.000"))).toBe("2027-03");
  });
});

describe("resolveFilters — 4. period format salah", () => {
  it.each(["2027-13", "2027-1", "2027/01", "januari", "2027-00", "27-01"])(
    'period=%s -> InvalidPeriodError status 400 dengan pesan jelas, tanpa query DB',
    async (bad) => {
      const p = resolveFilters(req(`period=${encodeURIComponent(bad)}`), user);
      await expect(p).rejects.toBeInstanceOf(InvalidPeriodError);
      await expect(p).rejects.toMatchObject({ status: 400 });
      await expect(p).rejects.toThrow(/Format period harus YYYY-MM/);
      expect(periodSettingFindFirst).not.toHaveBeenCalled();
    }
  );
});
