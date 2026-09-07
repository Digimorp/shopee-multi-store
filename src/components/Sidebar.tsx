"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon, type IconName } from "@/components/icons";

const MENU: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/input", label: "Input & Import Data", icon: "upload" },
  { href: "/keuangan", label: "Keuangan & Cashflow", icon: "wallet" },
  { href: "/laporan-profit", label: "Laporan Profit", icon: "coins" },
  { href: "/laporan-barang-keluar", label: "Analisis Barang Keluar", icon: "box" },
  { href: "/performa-toko", label: "Performa Toko", icon: "trendingUp" },
  { href: "/retur-cancel", label: "Retur & Pembatalan", icon: "undo" },
  { href: "/laporan-rekap", label: "Laporan Rekapan", icon: "clipboard" },
];

const SETTINGS_MENU: { href: string; label: string; icon: IconName; ownerOnly: boolean }[] = [
  { href: "/settings/users", label: "User Management", icon: "users", ownerOnly: true },
  { href: "/settings/stores", label: "Master Data Toko", icon: "store", ownerOnly: true },
  { href: "/settings/products", label: "Master Produk & HPP", icon: "tag", ownerOnly: true },
  { href: "/settings/status-mapping", label: "Mapping Status Pesanan", icon: "sliders", ownerOnly: true },
  { href: "/settings/periods", label: "Period & Cut-Off", icon: "calendar", ownerOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const itemClass = (href: string) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive(href)
        ? "bg-brand-gradient text-white shadow-[0_8px_20px_rgba(236,72,153,0.35)]"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
    }`;

  return (
    <aside className="hidden w-[230px] shrink-0 border-r border-gray-100 bg-white md:flex md:flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-white shadow-[0_6px_16px_rgba(236,72,153,0.4)]">
          <Icon name="store" size={18} strokeWidth={2} />
        </span>
        <span className="text-[15px] font-bold leading-tight text-gray-900">
          Shopee
          <br />
          <span className="text-gray-400">Multi-Toko</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {MENU.map((m) => (
          <Link key={m.href} href={withQs(m.href)} className={itemClass(m.href)}>
            <Icon name={m.icon} size={18} />
            <span className="truncate">{m.label}</span>
          </Link>
        ))}

        <div className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
          Pengaturan
        </div>
        {SETTINGS_MENU.filter((m) => !m.ownerOnly || role === "OWNER").map((m) => (
          <Link key={m.href} href={withQs(m.href)} className={itemClass(m.href)}>
            <Icon name={m.icon} size={18} />
            <span className="truncate">{m.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
