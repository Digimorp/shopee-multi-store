"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { getDefaultPeriod } from "@/lib/period";
import { Icon } from "@/components/icons";
import AlertBell from "@/components/AlertBell";
import SlidingTabs from "@/components/SlidingTabs";
import { MENU, isNavActive } from "@/components/navConfig";
import { useSidebar } from "@/components/SidebarContext";
import type { StoreOption } from "@/types";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded-md bg-gray-100 ${className}`} />;
}

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { open: sidebarOpen, toggle } = useSidebar();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const def = getDefaultPeriod();

  const storeId = searchParams.get("storeId") ?? "all";
  const from = searchParams.get("from") ?? toInputDate(def.from);
  const to = searchParams.get("to") ?? toInputDate(def.to);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores ?? []))
      .finally(() => setStoresLoaded(true));
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (!params.get("from")) params.set("from", from);
    if (!params.get("to")) params.set("to", to);
    if (!params.get("storeId")) params.set("storeId", storeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const sessionLoading = status === "loading";
  const role = (session?.user as any)?.role as string | undefined;
  const name = session?.user?.name ?? "";
  const initials = name
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Tab navigasi = menu utama yang sama dengan rail ikon (navConfig), filter toko/periode ikut terbawa.
  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);
  const tabItems = MENU.map((m) => ({ key: m.href, label: m.tabLabel, href: withQs(m.href) }));
  // Halaman di luar menu utama (mis. /settings/*) -> tidak ada tab aktif, pill disembunyikan.
  const activeTab = MENU.find((m) => isNavActive(pathname, m.href))?.href ?? null;

  const fieldClass =
    "rounded-full border-0 bg-gray-100 px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-300";
  const dateClass = "w-[7.75rem] min-w-0 shrink border-0 bg-transparent py-1 text-sm text-gray-700 outline-none sm:w-auto";
  const iconBtnClass =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:text-brand-500";

  // Filter toko baru boleh dirender setelah sesi + daftar toko siap
  // (opsi "Semua Toko" tergantung role) — sebelum itu tampilkan skeleton, bukan tebakan.
  const filterReady = !sessionLoading && storesLoaded;

  return (
    <header className="theme-mono border-b border-neutral-200 bg-white">
      {/* Baris 1: logo + tab navigasi + kontrol user. Di < lg tab turun ke baris sendiri (order-last). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={toggle}
          aria-label={sidebarOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          className={`${iconBtnClass} lg:hidden`}
        >
          <Icon name="menu" size={18} />
        </button>

        <Link
          href={withQs("/dashboard")}
          aria-label="Shopee Multi-Toko — ke Dashboard"
          className="flex shrink-0 items-center gap-2.5"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-950 text-white">
            <Icon name="store" size={18} strokeWidth={2} />
          </span>
          <span className="hidden text-[15px] font-bold leading-tight text-neutral-950 2xl:block">
            Shopee <span className="text-neutral-400">Multi-Toko</span>
          </span>
        </Link>

        <SlidingTabs
          ariaLabel="Navigasi utama"
          items={tabItems}
          activeKey={activeTab}
          className="order-last w-full lg:order-none lg:min-w-0 lg:w-auto lg:flex-1"
        />

        <div className="ml-auto flex items-center gap-2">
          <AlertBell />

          <div className="mx-1 h-6 w-px bg-gray-200" />

          {sessionLoading ? (
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="hidden flex-col gap-1 xl:flex">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                {initials || "U"}
              </span>
              <div className="hidden leading-tight xl:block">
                <div className="text-sm font-semibold text-gray-800">{name}</div>
                <div className="text-[11px] text-gray-400">{role === "OWNER" ? "Owner" : "Admin Toko"}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Keluar"
                aria-label="Keluar"
                className={iconBtnClass}
              >
                <Icon name="logout" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Baris 2: filter toko, pencarian, rentang tanggal (sama persis fungsinya dengan sebelumnya). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-2 sm:px-6">
        {!filterReady ? (
          <Skeleton className="h-9 w-40 rounded-full" />
        ) : stores.length === 0 ? (
          <a
            href="/settings/stores"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100"
          >
            Belum ada toko, tambahkan di Master Data Toko
          </a>
        ) : (
          <select value={storeId} onChange={(e) => updateParam("storeId", e.target.value)} className={fieldClass}>
            {role === "OWNER" && <option value="all">Semua Toko ({stores.length})</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        )}
        {/* Tampilan saja: belum ada logic pencarian, sama seperti tombol ikon sebelumnya. */}
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-gray-400 focus-within:ring-2 focus-within:ring-brand-300">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Cari…"
            aria-label="Cari"
            className="w-full min-w-0 border-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
        </label>
        <div className="flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 focus-within:ring-2 focus-within:ring-brand-300 sm:gap-2 sm:px-4">
          <input type="date" value={from} onChange={(e) => updateParam("from", e.target.value)} className={dateClass} />
          <span className="text-sm text-gray-400">s/d</span>
          <input type="date" value={to} onChange={(e) => updateParam("to", e.target.value)} className={dateClass} />
        </div>
      </div>
    </header>
  );
}
