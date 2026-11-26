import type { IconName } from "@/components/icons";

// Sumber tunggal daftar menu: dipakai rail ikon (Sidebar) DAN tab horizontal (TopBar),
// supaya keduanya tidak pernah beda tujuan.
// T-013 batch 15 (bagian B): 13 menu -> 5. Laporan bulanan & pengaturan jadi halaman bertab.
export type NavItem = { href: string; label: string; icon: IconName; ownerOnly?: boolean };

export const MENU: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/input", label: "Upload Data", icon: "upload" },
  { href: "/on-proses", label: "On Proses", icon: "hourglass" },
  { href: "/bulanan", label: "Bulanan", icon: "calendar" },
  // T-013 batch 21: Pengaturan juga untuk Admin Toko (tab dibatasi per peran, lihat pengaturanTabsForRole).
  { href: "/pengaturan", label: "Pengaturan", icon: "sliders" },
];

/** Menu yang boleh dilihat peran ini. Peran belum diketahui (sesi dimuat) -> tanpa menu Owner. */
export const menuForRole = (role: string | undefined | null): NavItem[] =>
  MENU.filter((m) => !m.ownerOnly || role === "OWNER");

export type TabDef = { key: string; label: string; ownerOnly?: boolean };

/** Tab halaman Bulanan (urut). Tab pertama = default. Semua mengikuti filter Periode + Toko. */
export const BULANAN_TABS: TabDef[] = [
  { key: "rekap", label: "Rekap" },
  { key: "uang-cair", label: "Uang Cair" },
  { key: "per-toko", label: "Per Toko" },
  { key: "retur", label: "Retur & Batal" },
  { key: "profit", label: "Profit & Barang Keluar" },
];

/**
 * Tab halaman Pengaturan. T-013 batch 21: Admin Toko hanya Toko + Produk & HPP; User, Aturan, Log Aktivitas
 * tetap Owner (dicek juga di SERVER: halaman /pengaturan dan API-nya).
 */
export const PENGATURAN_TABS: TabDef[] = [
  { key: "toko", label: "Toko" },
  { key: "produk", label: "Produk & HPP" },
  { key: "user", label: "User", ownerOnly: true },
  { key: "aturan", label: "Aturan", ownerOnly: true },
  { key: "log", label: "Log Aktivitas", ownerOnly: true },
];

/** Tab Pengaturan yang boleh dibuka peran ini. Peran tidak dikenal -> hanya tab non-Owner. */
export const pengaturanTabsForRole = (role: string | undefined | null): TabDef[] =>
  PENGATURAN_TABS.filter((t) => !t.ownerOnly || role === "OWNER");

export const pickTab = (tabs: TabDef[], key: string | null | undefined) =>
  tabs.find((t) => t.key === key)?.key ?? tabs[0].key;

/** Query filter yang terbawa saat pindah menu/tab: hanya Toko + Periode (+ from/to link lama). */
export const FILTER_KEYS = ["storeId", "period", "from", "to"] as const;
export function filterQuery(params: URLSearchParams | Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    if (typeof v === "string" && v !== "") out.set(k, v);
  }
  return out;
}

/** Href menu/tab dengan filter Toko + Periode ikut terbawa. */
export function hrefWithFilter(base: string, params: URLSearchParams, extra: Record<string, string> = {}): string {
  const q = filterQuery(params);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * Route lama -> tujuan baru (route lama TIDAK dihapus; page-nya jadi redirect). Semua query lama ikut
 * (filter, reconTab, dll.), lalu `tab` diisi sesuai tujuan.
 */
export const LEGACY_ROUTES: Record<string, { path: string; tab: string }> = {
  "/laporan-rekap": { path: "/bulanan", tab: "rekap" },
  "/rekonsiliasi": { path: "/bulanan", tab: "uang-cair" },
  "/keuangan": { path: "/bulanan", tab: "uang-cair" },
  "/performa-toko": { path: "/bulanan", tab: "per-toko" },
  "/retur-cancel": { path: "/bulanan", tab: "retur" },
  "/laporan-profit": { path: "/bulanan", tab: "profit" },
  "/laporan-barang-keluar": { path: "/bulanan", tab: "profit" },
  "/settings/stores": { path: "/pengaturan", tab: "toko" },
  "/settings/products": { path: "/pengaturan", tab: "produk" },
  "/settings/users": { path: "/pengaturan", tab: "user" },
  "/settings/status-mapping": { path: "/pengaturan", tab: "aturan" },
  "/settings/periods": { path: "/pengaturan", tab: "aturan" },
  "/settings/audit-log": { path: "/pengaturan", tab: "log" },
};

export function legacyRedirectUrl(oldPath: string, searchParams: Record<string, string | string[] | undefined>): string {
  const target = LEGACY_ROUTES[oldPath];
  if (!target) throw new Error(`Route lama tidak dikenal: ${oldPath}`);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0] != null) q.set(k, v[0]);
  }
  q.set("tab", target.tab);
  return `${target.path}?${q.toString()}`;
}

export const isNavActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
