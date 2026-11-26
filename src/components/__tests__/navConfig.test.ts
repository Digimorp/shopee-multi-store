/// <reference types="vite/client" />
import { describe, it, expect, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import {
  MENU,
  menuForRole,
  BULANAN_TABS,
  PENGATURAN_TABS,
  pickTab,
  hrefWithFilter,
  filterQuery,
  LEGACY_ROUTES,
  legacyRedirectUrl,
  pengaturanTabsForRole,
} from "@/components/navConfig";

// T-013 batch 15 (bagian B): menu 5 item, tab Bulanan/Pengaturan, redirect route lama.
describe("menu per peran", () => {
  it("Owner melihat 5 menu, urutan sesuai keputusan", () => {
    expect(menuForRole("OWNER").map((m) => m.label)).toEqual(["Dashboard", "Upload Data", "On Proses", "Bulanan", "Pengaturan"]);
    expect(MENU).toHaveLength(5);
  });
  // T-013 batch 21 (keputusan Founder): Admin Toko juga melihat Pengaturan (tabnya dibatasi, lihat bawah).
  it("Admin Toko & sesi belum dimuat juga melihat Pengaturan", () => {
    for (const role of ["ADMIN_TOKO", undefined, null]) {
      expect(menuForRole(role).map((m) => m.href)).toEqual(["/dashboard", "/input", "/on-proses", "/bulanan", "/pengaturan"]);
    }
  });
  it("tab Pengaturan per peran: Owner 5 tab, Admin Toko hanya Toko + Produk & HPP", () => {
    expect(pengaturanTabsForRole("OWNER").map((t) => t.key)).toEqual(["toko", "produk", "user", "aturan", "log"]);
    for (const role of ["ADMIN_TOKO", undefined, null]) {
      expect(pengaturanTabsForRole(role).map((t) => t.key)).toEqual(["toko", "produk"]);
    }
  });
});

describe("tab", () => {
  it("Bulanan: urutan Rekap..Profit, default Rekap; Pengaturan default Toko", () => {
    expect(BULANAN_TABS.map((t) => t.key)).toEqual(["rekap", "uang-cair", "per-toko", "retur", "profit"]);
    expect(pickTab(BULANAN_TABS, null)).toBe("rekap");
    expect(pickTab(BULANAN_TABS, "ngawur")).toBe("rekap");
    expect(pickTab(BULANAN_TABS, "profit")).toBe("profit");
    expect(PENGATURAN_TABS.map((t) => t.label)).toEqual(["Toko", "Produk & HPP", "User", "Aturan", "Log Aktivitas"]);
    expect(pickTab(PENGATURAN_TABS, undefined)).toBe("toko");
  });
});

describe("filter terbawa", () => {
  it("hanya storeId/period (+from/to lama) yang ikut; param halaman lain dibuang", () => {
    const sp = new URLSearchParams("storeId=s1&period=2026-10&tab=profit&reconTab=SELISIH&type=sku");
    expect(filterQuery(sp).toString()).toBe("storeId=s1&period=2026-10");
    expect(hrefWithFilter("/on-proses", sp)).toBe("/on-proses?storeId=s1&period=2026-10");
    expect(hrefWithFilter("/bulanan", sp, { tab: "retur" })).toBe("/bulanan?storeId=s1&period=2026-10&tab=retur");
    expect(hrefWithFilter("/dashboard", new URLSearchParams())).toBe("/dashboard");
  });
});

describe("redirect route lama", () => {
  it("query lama ikut, tab diisi", () => {
    expect(legacyRedirectUrl("/rekonsiliasi", { storeId: "s1", period: "2026-10", reconTab: "SELISIH" })).toBe(
      "/bulanan?storeId=s1&period=2026-10&reconTab=SELISIH&tab=uang-cair"
    );
    expect(legacyRedirectUrl("/laporan-profit", { from: "2026-09-26", to: "2026-10-25" })).toBe(
      "/bulanan?from=2026-09-26&to=2026-10-25&tab=profit"
    );
    expect(legacyRedirectUrl("/settings/periods", {})).toBe("/pengaturan?tab=aturan");
    expect(legacyRedirectUrl("/laporan-rekap", { tab: "lama", storeId: ["a", "b"] })).toBe("/bulanan?tab=rekap&storeId=a");
  });

  it("13 page route lama benar-benar me-redirect ke tujuannya", async () => {
    expect(Object.keys(LEGACY_ROUTES)).toHaveLength(13);
    // Tanda kurung di "(protected)" dibaca glob sebagai pola -> cocokkan lewat akhiran path.
    const pages = import.meta.glob("../../app/**/page.tsx");
    for (const [path, target] of Object.entries(LEGACY_ROUTES)) {
      const key = Object.keys(pages).find((k) => k.endsWith(`/(protected)${path}/page.tsx`));
      const load = key ? pages[key] : undefined;
      expect(load, path).toBeDefined();
      const mod: any = await load!();
      expect(() => mod.default({ searchParams: { period: "2026-10" } })).toThrow(
        `REDIRECT:${target.path}?period=2026-10&tab=${target.tab}`
      );
    }
  });
});
