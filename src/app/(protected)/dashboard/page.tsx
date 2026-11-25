"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import StatCard from "@/components/dashboard/StatCard";
import TopProductsTable from "@/components/TopProductsTable";
import AreaTrendCard from "@/components/dashboard/AreaTrendCard";
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
import { formatRupiah } from "@/lib/format";
import { formatRupiahOrDash, shownDashboardProfitHpp } from "@/lib/hppDisplay";
import { UANG_CAIR_LABEL, rincianUangCairSub } from "@/lib/uangCairPeriode";

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

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" sub={`Ringkasan ${periodLabel}, ${PERIOD_BASIS_NOTE}.`} storeFilter />

      <QuickActions selisihCount={summary?.selisihCount} />

      {/* T-013 temuan QA 8: pesan "Akun kamu belum dihubungkan ke toko" cukup sekali -- sudah tampil di TopBar. */}
      {shownError && !loading && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Sebagian data gagal dimuat. Angka di bawah mungkin tidak lengkap.</span>
          <button onClick={() => location.reload()} className="btn-ghost px-3 py-1.5 text-xs">
            Muat ulang
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaTrendCard trend={trend} summary={summary} loading={loading} error={shownError} periodLabel={periodLabel} />
        </div>
        <DonutCard rows={storePerf} loading={loading} error={shownError} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Omzet Pesanan" value={rp(summary?.totalOmzetBruto)} />
        {/* T-013 batch 13 (tugas X): semua saldo masuk Income Report periode ini + rincian (a)/(b)/(c). */}
        <StatCard
          label={UANG_CAIR_LABEL}
          tone="success"
          value={rp(summary?.uangCairPeriode?.total)}
          sub={rincianUangCairSub(summary?.uangCairPeriode)}
        />
        <StatCard
          label="Belum Cair"
          tone="warning"
          value={rp(summary?.belumCair)}
          sub={summary ? `${summary.belumCairCount ?? 0} pesanan menunggu pencairan` : undefined}
        />
        <StatCard
          label="Selisih (perlu dicek)"
          value={summary ? `${summary.selisihCount ?? 0} pesanan` : "-"}
          tone="danger"
          sub="sudah termasuk di Cair"
        />
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ActivityCard logs={logs} loading={loading} error={shownError} />
        <div className="lg:col-span-2">
          <RecentOrdersCard />
        </div>
      </div>

      <div className="card p-6">
        <p className="mb-3 text-sm font-semibold text-gray-800">Top 15 Produk Teratas</p>
        <TopProductsTable byOmzet={topProducts.byOmzet} byQty={topProducts.byQty} />
      </div>
    </div>
  );
}
