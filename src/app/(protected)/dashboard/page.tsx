"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCard from "@/components/SummaryCard";
import TopProductsTable from "@/components/TopProductsTable";
import AreaTrendCard from "@/components/dashboard/AreaTrendCard";
import DonutCard from "@/components/dashboard/DonutCard";
import ActivityCard from "@/components/dashboard/ActivityCard";
import RecentOrdersCard from "@/components/dashboard/RecentOrdersCard";
import type { TrendPoint } from "@/components/TrendChart";
import { getDefaultPeriod } from "@/lib/period";
import { formatRupiah } from "@/lib/format";

function fmtShort(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/dashboard/trend?${qs}`).then((r) => r.json()),
      fetch(`/api/dashboard/top-products?${qs}`).then((r) => r.json()),
      fetch(`/api/reports/store-performance?${qs}`).then((r) => r.json()),
      fetch(`/api/uploads`).then((r) => r.json()),
    ]).then(([s, t, p, sp, u]) => {
      setSummary(s);
      setTrend(t.trend ?? []);
      setTopProducts({ byOmzet: p.byOmzet ?? [], byQty: p.byQty ?? [] });
      setStorePerf(sp.rows ?? []);
      setLogs(u.logs ?? []);
      setLoading(false);
    });
  }, [qs]);

  const periodLabel = useMemo(() => {
    const def = getDefaultPeriod();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    return `${fmtShort(from ? new Date(from) : def.from)} – ${fmtShort(to ? new Date(to) : def.to)}`;
  }, [searchParams]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Utama</h1>
        <p className="text-sm text-gray-400">Ringkasan performa penjualan multi-toko Shopee</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaTrendCard trend={trend} summary={summary} loading={loading} periodLabel={periodLabel} />
        </div>
        <DonutCard rows={storePerf} loading={loading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard gradient="pink" icon="cash" label="Total Omzet Bruto" value={formatRupiah(summary?.totalOmzetBruto ?? 0)} />
        <SummaryCard gradient="purple" icon="coins" label="Uang Cair" value={formatRupiah(summary?.uangCair ?? 0)} />
        <SummaryCard gradient="blue" icon="trendingUp" label="Profit HPP (Nett)" value={formatRupiah(summary?.profitHpp ?? 0)} />
        <SummaryCard gradient="orange" icon="sparkles" label="Profit Agen" value={formatRupiah(summary?.profitAgen ?? 0)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ActivityCard logs={logs} loading={loading} />
        <div className="lg:col-span-2">
          <RecentOrdersCard />
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-gray-800">Top 15 Produk Teratas</p>
        <TopProductsTable byOmzet={topProducts.byOmzet} byQty={topProducts.byQty} />
      </div>
    </div>
  );
}
