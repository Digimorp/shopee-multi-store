"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { getCurrentPeriodMonth } from "@/lib/period";
import { Icon } from "@/components/icons";
import AlertBell from "@/components/AlertBell";
import TopNavTabs from "@/components/TopNavTabs";
import { menuForRole, hrefWithFilter, isNavActive } from "@/components/navConfig";
import { useSidebar } from "@/components/SidebarContext";
import type { StoreOption } from "@/types";
import { PERIOD_BASIS_NOTE, PERIOD_OPTIONS, convertLegacyRange, formatPeriodRange } from "@/lib/periodPicker";

const PERIOD_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const INVALID_PERIOD = "__invalid-period";

/** "2027-01" mundur n bulan -> "2026-11" dst. */
function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
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
  // cutoffDay dari /api/periods (sumber yang sama dengan server). null = belum dimuat.
  const [cutoffDay, setCutoffDay] = useState<number | null>(null);

  const storeId = searchParams.get("storeId") ?? "all";
  const periodParam = searchParams.get("period") || null; // period= kosong = tidak ada (sama seperti server)
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores ?? []))
      .finally(() => setStoresLoaded(true));
  }, []);

  useEffect(() => {
    fetch("/api/periods")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCutoffDay(Number.isInteger(d.cutoffDay) ? d.cutoffDay : 25))
      .catch(() => setCutoffDay(25)); // sama dengan default server kalau PeriodSetting kosong
  }, []);

  // Bulan periode berjalan WIB — dihitung dengan fungsi yang sama persis dengan server (resolveFilters).
  const currentMonth = cutoffDay != null ? getCurrentPeriodMonth(cutoffDay) : null;

  // T-013 batch 15 (bagian C): link lama ?from=&to= diterima lalu diganti jadi ?period=YYYY-MM
  // (periode yang memuat tanggal `to`) -- tanpa entri riwayat baru. Tidak ada input tanggal lagi.
  const hasLegacyRange = fromParam != null || toParam != null;
  useEffect(() => {
    if (cutoffDay == null || !hasLegacyRange) return;
    const next = convertLegacyRange(new URLSearchParams(searchParams.toString()), cutoffDay);
    if (next) router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }, [cutoffDay, hasLegacyRange, searchParams, pathname, router]);

  // Nilai pilihan aktif: period di URL > default bulan berjalan. Selama link lama dikonversi -> skeleton.
  const selectedPeriod = periodParam
    ? PERIOD_PARAM.test(periodParam)
      ? periodParam
      : INVALID_PERIOD
    : hasLegacyRange
      ? null
      : currentMonth;
  // On Proses memakai semua periode (hanya filter Toko) -> pemilih Periode disembunyikan di sana.
  const periodApplies = !isNavActive(pathname, "/on-proses");

  const monthOptions = currentMonth ? Array.from({ length: PERIOD_OPTIONS }, (_, i) => shiftMonth(currentMonth, i)) : [];
  // T-013 batch 16: 12 periode terakhir, terbaru di atas. Link ke periode yang lebih lama tetap tampil sebagai pilihan, tidak dipaksa ganti.
  if (periodParam && PERIOD_PARAM.test(periodParam) && !monthOptions.includes(periodParam)) monthOptions.push(periodParam);
  // Nama periode = rentang tanggal (bukan nama bulan); periode yang sedang berjalan diberi "(berjalan)".
  const monthLabel = (m: string) => `${formatPeriodRange(m, cutoffDay ?? 25)}${m === currentMonth ? " (berjalan)" : ""}`;

  function pushParams(params: URLSearchParams) {
    if (!params.get("storeId")) params.set("storeId", storeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    // Belum ada filter periode -> tulis eksplisit bulan berjalan supaya ikut terbawa antar menu.
    if (!params.get("period") && currentMonth) {
      params.set("period", currentMonth);
    }
    pushParams(params);
  }

  function selectMonth(month: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", month);
    params.delete("from");
    params.delete("to");
    pushParams(params);
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

  // Tab navigasi = menu utama yang sama dengan rail ikon (navConfig), per peran.
  // T-013 batch 15: hanya filter Toko + Periode yang terbawa (bukan tab/param halaman lain).
  const withQs = (href: string) => hrefWithFilter(href, searchParams);
  const menu = menuForRole(sessionLoading ? undefined : role);
  const tabItems = menu.map((m) => ({ key: m.href, label: m.label, href: withQs(m.href) }));
  const activeTab = menu.find((m) => isNavActive(pathname, m.href))?.href ?? null;

  const fieldClass =
    "rounded-full border-0 bg-gray-100 px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-300";
  const iconBtnClass =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:text-brand-500";

  // Filter toko baru boleh dirender setelah sesi + daftar toko siap
  // (opsi "Semua Toko" tergantung role) — sebelum itu tampilkan skeleton, bukan tebakan.
  const filterReady = !sessionLoading && storesLoaded;

  return (
    <header className="border-b border-neutral-200 bg-white">
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

        <TopNavTabs
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

      {/* Baris 2: filter Toko + satu pemilih Periode (bulan) beserta rentang aslinya. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-2 sm:px-6">
        {!filterReady ? (
          <Skeleton className="h-9 w-40 rounded-full" />
        ) : stores.length === 0 ? (
          role === "OWNER" ? (
            <a
              href="/pengaturan?tab=toko"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100"
            >
              Belum ada toko, tambahkan di Pengaturan &gt; Toko
            </a>
          ) : (session?.user as any)?.invalid ? null : (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Akun kamu belum dihubungkan ke toko. Hubungi Owner.
            </span>
          )
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
        {!periodApplies ? (
          <span className="text-xs text-gray-500">Semua periode (On Proses tidak mengikuti filter Periode)</span>
        ) : selectedPeriod == null ? (
          <Skeleton className="h-9 w-40 rounded-full" />
        ) : (
          <>
          <select
            value={selectedPeriod}
            onChange={(e) => selectMonth(e.target.value)}
            aria-label="Periode"
            title={`Periode cut-off tgl ${(cutoffDay ?? 25) + 1}–${cutoffDay ?? 25} (WIB)`}
            className={`${fieldClass} max-w-full`}
          >
            {selectedPeriod === INVALID_PERIOD && (
              <option value={INVALID_PERIOD} disabled>
                Periode tidak valid: {periodParam}
              </option>
            )}
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          {/* Rentang sudah jadi nama opsi -> tidak ditulis dobel; cukup keterangan dasar tanggalnya. */}
          <span className="text-[11px] leading-tight text-gray-400">{PERIOD_BASIS_NOTE}</span>
          </>
        )}
      </div>
    </header>
  );
}
