"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCard from "@/components/SummaryCard";
import TrendChart, { TrendPoint } from "@/components/TrendChart";
import TopProductsTable from "@/components/TopProductsTable";
import { formatRupiah } from "@/lib/format";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<{ byOmzet: any[]; byQty: any[] }>({ byOmzet: [], byQty: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/dashboard/trend?${qs}`).then((r) => r.json()),
      fetch(`/api/dashboard/top-products?${qs}`).then((r) => r.json()),
    ]).then(([s, t, p]) => {
      setSummary(s);
      setTrend(t.trend ?? []);
      setTopProducts({ byOmzet: p.byOmzet ?? [], byQty: p.byQty ?? [] });
      setLoading(false);
    });
  }, [qs]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Dashboard Utama</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total Omzet Bruto" value={formatRupiah(summary?.totalOmzetBruto ?? 0)} accent="brand" />
        <SummaryCard label="Uang Cair" value={formatRupiah(summary?.uangCair ?? 0)} accent="green" />
        <SummaryCard label="Uang Mengambang" value={formatRupiah(summary?.uangMengambang ?? 0)} accent="purple" />
        <SummaryCard label="Profit HPP (Nett)" value={formatRupiah(summary?.profitHpp ?? 0)} accent="green" />
        <SummaryCard label="Profit Agen" value={formatRupiah(summary?.profitAgen ?? 0)} accent="blue" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Grafik Performa Toko (Tren Harian)</h2>
        {loading ? <div className="py-10 text-center text-sm text-gray-400">Memuat...</div> : <TrendChart data={trend} />}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Top 15 Produk Teratas</h2>
        <TopProductsTable byOmzet={topProducts.byOmzet} byQty={topProducts.byQty} />
      </div>
    </div>
  );
}
