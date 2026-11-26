"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { getCurrentPeriodMonth } from "@/lib/period";
import { Icon } from "@/components/icons";
import AlertBell from "@/components/AlertBell";
import BrandLogo from "@/components/BrandLogo";
import TopNavTabs from "@/components/TopNavTabs";
import { menuForRole, hrefWithFilter, isNavActive } from "@/components/navConfig";
import { useCutoffDay } from "@/components/StoreChips";
import { PERIOD_OPTIONS, convertLegacyRange, formatPeriodRange } from "@/lib/periodPicker";

const PERIOD_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const INVALID_PERIOD = "__invalid-period";

/** "2027-01" mundur n bulan -> "2026-11" dst. */
function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded-full bg-white/60 ${className}`} />;
}

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  // cutoffDay dari /api/periods (sumber yang sama dengan server). null = belum dimuat.
  const cutoffDay = useCutoffDay();

  const storeId = searchParams.get("storeId") ?? "all";
  const periodParam = searchParams.get("period") || null; // period= kosong = tidak ada (sama seperti server)
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

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
  // Keterangan dasar tanggal periode kini ada di bawah judul halaman (PageHeader), bukan di sini.
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

  // Tab navigasi = menu utama yang sama dengan rel ikon (navConfig), per peran.
  // T-013 batch 15: hanya filter Toko + Periode yang terbawa (bukan tab/param halaman lain).
  const withQs = (href: string) => hrefWithFilter(href, searchParams);
  const menu = menuForRole(sessionLoading ? undefined : role);
  const tabItems = menu.map((m) => ({ key: m.href, label: m.label, href: withQs(m.href) }));
  const activeTab = menu.find((m) => isNavActive(pathname, m.href))?.href ?? null;

  // Menu akun (avatar bulat): nama, peran, Keluar. Tutup saat klik di luar / Escape / pindah halaman.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => setAccountOpen(false), [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAccountOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  // T-013 batch 18 (Kaca Lembut). >= 820px: logo | pil menu | chip periode, lonceng, avatar (satu baris).
  // < 820px: baris 1 logo + lonceng + avatar; baris 2 pil menu (geser horizontal); baris 3 chip periode.
  return (
    <header className="relative z-20 flex flex-wrap items-center gap-3 px-4 pb-4 pt-4 sm:px-6">
      <Link
        href={withQs("/dashboard")}
        aria-label="Aplikasi Marketplace — ke Dashboard"
        className="order-1 flex shrink-0 items-center gap-3 rounded-xl"
      >
        {/* T-013 batch 20: logo Penerbit Insan Kamil. Nama aplikasi baru tampil >= 1400px (keputusan Founder):
            di 1280 teks ~172px membuat menu tinggal 454px padahal 5 menu butuh ~554px -> 2 menu masuk "Lainnya". */}
        <BrandLogo size="sm" />
        <span className="hidden whitespace-nowrap text-[17px] font-bold leading-tight text-ink min-[1400px]:block">Aplikasi Marketplace</span>
      </Link>

      <TopNavTabs
        items={tabItems}
        activeKey={activeTab}
        className="order-3 w-full min-[820px]:order-2 min-[820px]:w-auto min-[820px]:flex-1"
      />

      {/* Chip periode: satu pemilih Periode (bulan) beserta rentang aslinya. */}
      <div className="order-4 flex min-w-0 max-w-full items-center min-[820px]:order-3">
        {!periodApplies ? (
          <span className="chip font-semibold text-muted">Semua periode</span>
        ) : selectedPeriod == null ? (
          <Skeleton className="h-11 w-56" />
        ) : (
          <label className="relative block max-w-full">
            <span className="sr-only">Periode</span>
            <select
              value={selectedPeriod}
              onChange={(e) => selectMonth(e.target.value)}
              title={`Periode cut-off tgl ${(cutoffDay ?? 25) + 1}–${cutoffDay ?? 25} (WIB)`}
              className="chip max-w-full cursor-pointer appearance-none pr-10"
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
            <Icon
              name="chevronDown"
              size={16}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink"
            />
          </label>
        )}
      </div>

      <div className="order-2 ml-auto flex items-center gap-2 min-[820px]:order-4 min-[820px]:ml-0">
        <AlertBell />

        {sessionLoading ? (
          <Skeleton className="h-11 w-11" />
        ) : (
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={`Akun: ${name || "pengguna"}`}
              className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-sm font-bold text-white"
            >
              {initials || "U"}
            </button>
            {accountOpen && (
              <div
                role="menu"
                aria-label="Menu akun"
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-white bg-white p-2 shadow-glass"
              >
                <div className="px-3 py-2">
                  <div className="truncate text-sm font-semibold text-ink">{name}</div>
                  <div className="text-xs text-muted">{role === "OWNER" ? "Owner" : "Admin Toko"}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5"
                >
                  <Icon name="logout" size={18} />
                  Keluar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
