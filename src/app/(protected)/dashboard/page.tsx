"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import StatCard from "@/components/dashboard/StatCard";
import TopProductsTable from "@/components/TopProductsTable";
import AreaTrendCard, { BUCKET_TABS, type Bucket } from "@/components/dashboard/AreaTrendCard";
import UangCairCard from "@/components/dashboard/UangCairCard";
import SlidingTabs from "@/components/SlidingTabs";
import { Icon } from "@/components/icons";
import { useStores } from "@/components/StoreChips";
import { hrefWithFilter } from "@/components/navConfig";
import DonutCard from "@/components/dashboard/DonutCard";
import ActivityCard from "@/components/dashboard/ActivityCard";
import RecentOrdersCard from "@/components/dashboard/RecentOrdersCard";
import QuickActions from "@/components/dashboard/QuickActions";
import TanpaHppNote from "@/components/TanpaHppNote";
import PageHeader from "@/components/PageHeader";
import { PERIOD_BASIS_NOTE } from "@/lib/periodPicker";
import type { TrendPoint } from "@/components/TrendChart";
import {
  formatPeriodRangeLabel,
  getCurrentPeriodMonth,
  getDefaultPeriod,
  getPeriodForMonth,
} from "@/lib/period";
import { formatNumber, formatRupiah } from "@/lib/format";
import { formatRupiahOrDash, shownDashboardProfitHpp } from "@/lib/hppDisplay";

const PERIOD_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;

function fmtShort(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Tanggal batas periode ditampilkan dalam WIB, apa pun zona waktu browser. */
function fmtWib(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<{ byOmzet: any[]; byQty: any[] }>({ byOmzet: [], byQty: [] });
  const [storePerf, setStorePerf] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Admin Toko yang belum dihubungkan ke toko mana pun: API menjawab 403, itu bukan "gagal muat".
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const noStore = !!sessionUser && sessionUser.role !== "OWNER" && Array.isArray(sessionUser.storeIds) && sessionUser.storeIds.length === 0;
  const shownError = error && !noStore;
  // T-013 temuan QA 8: tanpa data ringkasan (akun tanpa toko -> 403, atau gagal muat) kartu tampil
  // "-", bukan "Rp 0" yang terlihat seperti angka sungguhan.
  const rp = (v: number | undefined) => (summary ? formatRupiah(v ?? 0) : "-");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    // Safety net: apa pun yang terjadi, jangan stuck "Memuat" > 20 detik.
    const killLoading = setTimeout(() => alive && setLoading(false), 20000);

    Promise.allSettled([
      getJson(`/api/dashboard/summary?${qs}`),
      getJson(`/api/dashboard/trend?${qs}`),
      getJson(`/api/dashboard/top-products?${qs}`),
      getJson(`/api/reports/store-performance?${qs}`),
      getJson(`/api/uploads`),
    ]).then(([s, t, p, sp, u]) => {
      if (!alive) return;
      const val = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : null);
      const anyFailed = [s, t, p, sp, u].some((r) => r.status === "rejected");

      setSummary(val(s));
      setTrend(val(t)?.trend ?? []);
      setTopProducts({ byOmzet: val(p)?.byOmzet ?? [], byQty: val(p)?.byQty ?? [] });
      setStorePerf(val(sp)?.rows ?? []);
      setLogs(val(u)?.logs ?? []);
      setError(anyFailed);
      setLoading(false);
    });

    return () => {
      alive = false;
      clearTimeout(killLoading);
    };
  }, [qs]);

  // cutoffDay dari /api/periods — sumber yang sama dengan server & TopBar. null = belum dimuat.
  const [cutoffDay, setCutoffDay] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/periods")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCutoffDay(Number.isInteger(d.cutoffDay) ? d.cutoffDay : 25))
      .catch(() => setCutoffDay(25));
  }, []);

  // Urutan sama dengan resolveFilters: period=YYYY-MM > link lama from/to > bulan berjalan WIB.
  const periodLabel = useMemo(() => {
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    // T-013 batch 16: nama periode = rentang tanggal ("26 Jun - 25 Jul 2026"), bukan nama bulan.
    if (period && PERIOD_PARAM.test(period)) {
      if (cutoffDay == null) return "…";
      return formatPeriodRangeLabel(getPeriodForMonth(period, cutoffDay));
    }
    if (from || to) {
      const def = getDefaultPeriod();
      return `${fmtShort(from ? new Date(from) : def.from)} – ${fmtShort(to ? new Date(to) : def.to)}`;
    }
    if (cutoffDay == null) return "…";
    return formatPeriodRangeLabel(getPeriodForMonth(getCurrentPeriodMonth(cutoffDay), cutoffDay));
  }, [searchParams, cutoffDay]);

  const [bucket, setBucket] = useState<Bucket>("daily");

  // T-013 batch 18: keadaan kosong. null = daftar toko belum dimuat.
  const stores = useStores();
  const noStores = stores != null && stores.length === 0;
  const noData =
    !loading &&
    !!summary &&
    trend.length === 0 &&
    (summary.totalOmzetBruto ?? 0) === 0 &&
    (summary.uangCairPeriode?.total ?? 0) === 0;
  const isOwner = sessionUser?.role === "OWNER";

  // Baris angka ringkas (angka & keterangan yang sudah ada, tanpa perbandingan periode lalu).
  const kpis: { icon: string; label: string; value: string; href?: string; hrefLabel?: string }[] = [
    { icon: "wallet", label: "Uang Cair", value: rp(summary?.uangCairPeriode?.total) },
    { icon: "trendingUp", label: "Omzet Pesanan", value: rp(summary?.totalOmzetBruto) },
    { icon: "check", label: "Pesanan cair", value: summary ? formatNumber(summary.cairCount ?? 0) : "-" },
    {
      icon: "hourglass",
      label: "Belum cair",
      value: summary ? `${formatNumber(summary.belumCairCount ?? 0)} pesanan` : "-",
      href: hrefWithFilter("/on-proses", searchParams),
      hrefLabel: "Lihat On Proses",
    },
  ];

  const kpiStrip = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 xl:flex xl:gap-8">
      {kpis.map((k) => (
        <div key={k.label} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80 text-accent-text shadow-glass">
            <Icon name={k.icon} size={18} />
          </span>
          <div className="min-w-0">
            <dd className="num break-words text-lg font-bold leading-tight text-ink">{k.value}</dd>
            <dt className="text-xs font-semibold text-muted-deep">
              {k.href ? (
                <Link href={k.href} className="inline-flex min-h-6 items-center gap-1 text-accent-text underline-offset-2 hover:underline">
                  {k.label} · {k.hrefLabel}
                  <Icon name="arrowRight" size={12} />
                </Link>
              ) : (
                k.label
              )}
            </dt>
          </div>
        </div>
      ))}
    </dl>
  );

  if (noStores) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" sub={`Ringkasan ${periodLabel}.`} />
        <div className="card flex flex-col items-start gap-4 p-6 sm:p-8">
          {isOwner ? (
            <>
              <p className="text-base text-ink">Belum ada toko. Tambahkan toko dulu, lalu unggah data pesanannya.</p>
              <Link href="/pengaturan?tab=toko" className="btn-primary">
                Tambah toko
              </Link>
            </>
          ) : (
            <p className="text-base text-ink">Akun kamu belum dihubungkan ke toko. Hubungi Owner.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        sub={`Ringkasan ${periodLabel}, ${PERIOD_BASIS_NOTE}.`}
        aside={kpiStrip}
        storeFilter
        controls={
          <SlidingTabs
            ariaLabel="Satuan waktu grafik"
            variant="segment"
            size="sm"
            items={BUCKET_TABS.map((t) => ({ key: t.key, label: t.label }))}
            activeKey={bucket}
            onSelect={(k) => setBucket(k as Bucket)}
          />
        }
      />

      {/* T-013 temuan QA 8: pesan "Akun kamu belum dihubungkan ke toko" cukup sekali -- sudah tampil di baris toko. */}
      {shownError && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Sebagian data gagal dimuat. Angka di bawah mungkin tidak lengkap.</span>
          <button onClick={() => location.reload()} className="btn-ghost">
            Muat ulang
          </button>
        </div>
      )}

      {noData ? (
        <div className="card flex flex-col items-start gap-4 p-6 sm:p-8">
          <p className="text-base text-ink">Belum ada data pada periode ini. Unggah file pesanan atau Income Report dulu.</p>
          <Link href={hrefWithFilter("/input", searchParams)} className="btn-primary">
            Upload Data
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
            <AreaTrendCard
              trend={trend}
              summary={summary}
              loading={loading}
              error={shownError}
              periodLabel={periodLabel}
              bucket={bucket}
            />
            {/* T-013 batch 13 (tugas X): semua saldo masuk Income Report periode ini + rincian (a)/(b)/(c). */}
            <UangCairCard rincian={summary?.uangCairPeriode} loading={loading} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <QuickActions selisihCount={summary ? summary.selisihCount ?? 0 : undefined} />
            <StatCard
              label="Profit HPP (Nett)"
              value={formatRupiahOrDash(shownDashboardProfitHpp(summary))}
              negative={(summary?.profitHpp ?? 0) < 0}
            />
            <StatCard
              label="Profit Agen"
              value={rp(summary?.profitAgen)}
              negative={(summary?.profitAgen ?? 0) < 0}
            />
          </div>
          <TanpaHppNote tanpaHpp={summary?.tanpaHpp} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.25fr]">
            <DonutCard rows={storePerf} loading={loading} error={shownError} />
            <ActivityCard logs={logs} loading={loading} error={shownError} />
          </div>

          <RecentOrdersCard />

          <div className="card p-5 sm:p-6">
            <h2 className="mb-3 text-base font-bold text-ink">Top 15 Produk Teratas</h2>
            <TopProductsTable byOmzet={topProducts.byOmzet} byQty={topProducts.byQty} />
          </div>
        </>
      )}
    </div>
  );
}
