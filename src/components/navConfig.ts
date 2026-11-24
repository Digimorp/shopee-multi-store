import type { IconName } from "@/components/icons";

// Sumber tunggal daftar menu: dipakai rail ikon (Sidebar) DAN tab horizontal (TopBar),
// supaya keduanya tidak pernah beda tujuan. `tabLabel` = label pendek untuk tab di top bar.
export type NavItem = { href: string; label: string; tabLabel: string; icon: IconName };
export type SettingsNavItem = NavItem & { ownerOnly: boolean };

export const MENU: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", tabLabel: "Dashboard", icon: "home" },
  { href: "/input", label: "Input & Import Data", tabLabel: "Input & Import Data", icon: "upload" },
  { href: "/rekonsiliasi", label: "Keuangan & Rekonsiliasi", tabLabel: "Keuangan & Rekon", icon: "scale" },
  { href: "/laporan-profit", label: "Laporan Profit & Barang Keluar", tabLabel: "Laporan Profit", icon: "coins" },
  { href: "/performa-toko", label: "Performa Toko", tabLabel: "Performa Toko", icon: "trendingUp" },
  { href: "/retur-cancel", label: "Retur & Pembatalan", tabLabel: "Retur & Pembatalan", icon: "undo" },
  { href: "/laporan-rekap", label: "Laporan Rekapan", tabLabel: "Laporan Rekapan", icon: "clipboard" },
];

export const SETTINGS_MENU: SettingsNavItem[] = [
  { href: "/settings/users", label: "User Management", tabLabel: "User Management", icon: "users", ownerOnly: true },
  { href: "/settings/stores", label: "Master Data Toko", tabLabel: "Master Data Toko", icon: "store", ownerOnly: true },
  { href: "/settings/products", label: "Master Produk & HPP", tabLabel: "Master Produk & HPP", icon: "tag", ownerOnly: true },
  { href: "/settings/status-mapping", label: "Mapping Status Pesanan", tabLabel: "Mapping Status Pesanan", icon: "sliders", ownerOnly: true },
  { href: "/settings/periods", label: "Period & Cut-Off", tabLabel: "Period & Cut-Off", icon: "calendar", ownerOnly: true },
  { href: "/settings/audit-log", label: "Log Aktivitas Admin", tabLabel: "Log Aktivitas Admin", icon: "fileText", ownerOnly: true },
];

export const isNavActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
