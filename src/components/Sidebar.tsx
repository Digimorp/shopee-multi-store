"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon, type IconName } from "@/components/icons";

const MENU: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/input", label: "Input & Import Data", icon: "upload" },
  { href: "/keuangan", label: "Keuangan & Cashflow", icon: "wallet" },
  { href: "/rekonsiliasi", label: "Rekonsiliasi Uang Cair", icon: "scale" },
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
  { href: "/settings/audit-log", label: "Log Aktivitas Admin", icon: "fileText", ownerOnly: true },
];

// Label pemisah antar-grup menu di sidebar. Dibedakan jelas dari menu item:
// warna tint hijau muda pudar + bold, huruf lebih kecil, tracking lebar,
// dan jarak atas ekstra (pt, bukan mt — <nav> pakai space-y yang meng-override margin-top).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-7 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  // Jangan render menu Pengaturan (owner-only) sebelum sesi diketahui — cegah flash.
  const sessionReady = status !== "loading";

  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const itemClass = (href: string) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive(href)
        ? "bg-sidebar-active text-sidebar-activeText"
        : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
    }`;

  return (
    <aside className="hidden w-[230px] shrink-0 flex-col bg-sidebar md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <Icon name="store" size={18} strokeWidth={2} />
        </span>
        <span className="text-[15px] font-bold leading-tight text-white">
          Shopee
          <br />
          <span className="text-sidebar-muted">Multi-Toko</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MENU.map((m) => (
          <Link key={m.href} href={withQs(m.href)} className={itemClass(m.href)}>
            <Icon name={m.icon} size={18} />
            <span className="truncate">{m.label}</span>
          </Link>
        ))}

        {!sessionReady ? (
          <div className="space-y-2 px-3 pt-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-xl bg-sidebar-hover" />
            ))}
          </div>
        ) : (
          role === "OWNER" && (
            <>
              <SectionLabel>Pengaturan</SectionLabel>
              {SETTINGS_MENU.map((m) => (
                <Link key={m.href} href={withQs(m.href)} className={itemClass(m.href)}>
                  <Icon name={m.icon} size={18} />
                  <span className="truncate">{m.label}</span>
                </Link>
              ))}
            </>
          )
        )}
      </nav>
    </aside>
  );
}
