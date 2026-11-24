"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { formatPeriodMonthLabel, getCurrentPeriodMonth, getPeriodForMonth } from "@/lib/period";
import { Icon } from "@/components/icons";
import AlertBell from "@/components/AlertBell";
import { useSidebar } from "@/components/SidebarContext";
import type { StoreOption } from "@/types";

const PERIOD_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_OPTIONS = 24; // bulan berjalan + 23 bulan sebelumnya
const LEGACY_RANGE = "__legacy-range";
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

  // Nilai pilihan aktif: period di URL > link lama from/to > default bulan berjalan.
  const selectedPeriod = periodParam
    ? PERIOD_PARAM.test(periodParam)
      ? periodParam
      : INVALID_PERIOD
    : fromParam || toParam
      ? LEGACY_RANGE
      : currentMonth;

  const monthOptions = currentMonth ? Array.from({ length: MONTH_OPTIONS }, (_, i) => shiftMonth(currentMonth, i)) : [];
  // Link ke bulan di luar 24 bulan terakhir tetap tampil sebagai pilihan, tidak dipaksa ganti.
  if (periodParam && PERIOD_PARAM.test(periodParam) && !monthOptions.includes(periodParam)) monthOptions.push(periodParam);
  const monthLabel = (m: string) => formatPeriodMonthLabel(getPeriodForMonth(m, cutoffDay ?? 25));

  function pushParams(params: URLSearchParams) {
    if (!params.get("storeId")) params.set("storeId", storeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    // Belum ada filter waktu sama sekali -> tulis eksplisit bulan berjalan (dulu: from/to default).
    if (!params.get("period") && !params.get("from") && !params.get("to") && currentMonth) {
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

  const fieldClass =
    "rounded-full border-0 bg-gray-100 px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-300";
  const iconBtnClass =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:text-brand-500";

  // Filter toko baru boleh dirender setelah sesi + daftar toko siap
  // (opsi "Semua Toko" tergantung role) — sebelum itu tampilkan skeleton, bukan tebakan.
  const filterReady = !sessionLoading && storesLoaded;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-1">
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
        {selectedPeriod == null ? (
          <Skeleton className="h-9 w-40 rounded-full" />
        ) : (
          <select
            value={selectedPeriod}
            onChange={(e) => selectMonth(e.target.value)}
            aria-label="Periode cut-off"
            title={`Periode cut-off tgl ${(cutoffDay ?? 25) + 1}–${cutoffDay ?? 25} (WIB)`}
            className={`${fieldClass} max-w-full`}
          >
            {selectedPeriod === LEGACY_RANGE && (
              <option value={LEGACY_RANGE} disabled>
                {fromParam ?? "…"} s/d {toParam ?? "…"}
              </option>
            )}
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
        )}
      </div>

      <div className="flex items-center gap-2">
        <AlertBell />

        <div className="mx-1 h-6 w-px bg-gray-200" />

        {sessionLoading ? (
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="hidden flex-col gap-1 sm:flex">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {initials || "U"}
            </span>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold text-gray-800">{name}</div>
              <div className="text-[11px] text-gray-400">{role === "OWNER" ? "Owner" : "Admin Toko"}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Keluar"
              className={iconBtnClass}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
