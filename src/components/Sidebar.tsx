"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/input", label: "Input & Import Data" },
  { href: "/keuangan", label: "Keuangan & Cashflow" },
  { href: "/laporan-profit", label: "Laporan Profit" },
  { href: "/laporan-barang-keluar", label: "Analisis Barang Keluar" },
  { href: "/performa-toko", label: "Performa Toko" },
  { href: "/retur-cancel", label: "Retur & Pembatalan" },
  { href: "/laporan-rekap", label: "Laporan Rekapan" },
];

const SETTINGS_MENU = [
  { href: "/settings/users", label: "User Management", ownerOnly: true },
  { href: "/settings/stores", label: "Master Data Toko", ownerOnly: true },
  { href: "/settings/products", label: "Master Produk & HPP", ownerOnly: true },
  { href: "/settings/status-mapping", label: "Mapping Status Pesanan", ownerOnly: true },
  { href: "/settings/periods", label: "Period & Cut-Off", ownerOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);

  const linkClass = (href: string) =>
    `block rounded-md px-3 py-2 text-sm ${
      pathname === href ? "bg-brand-500 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white p-3 md:block">
      <div className="mb-4 px-2 text-lg font-bold text-brand-600">Shopee Multi-Toko</div>
      <nav className="space-y-1">
        {MENU.map((m) => (
          <Link key={m.href} href={withQs(m.href)} className={linkClass(m.href)}>
            {m.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 mb-2 px-2 text-xs font-semibold uppercase text-gray-400">Pengaturan</div>
      <nav className="space-y-1">
        {SETTINGS_MENU.filter((m) => !m.ownerOnly || role === "OWNER").map((m) => (
          <Link key={m.href} href={withQs(m.href)} className={linkClass(m.href)}>
            {m.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
