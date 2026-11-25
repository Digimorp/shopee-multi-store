"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import DataTable from "@/components/DataTable";
import ExportButtons from "@/components/ExportButtons";
import LeaderboardToko from "@/components/LeaderboardToko";
import TanpaHppNote, { sumTanpaHpp } from "@/components/TanpaHppNote";
import { formatAxisShort, formatRupiah, formatNumber } from "@/lib/format";
import { formatRupiahOrDash, shownProfitHpp, shownProfitAgen } from "@/lib/hppDisplay";

export default function PerformaTokoPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/reports/store-performance?${qs}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []));
  }, [qs]);

  const chartData = rows.slice(0, 14).map((r) => ({
    toko: r.toko.split(" - ")[0],
    Omzet: Math.round(r.omzet),
    // T-013 temuan QA 2: profit tidak diketahui -> tanpa batang (null), tooltip "-".
    "Profit HPP": (() => {
      const v = shownProfitHpp(r);
      return typeof v === "string" ? null : Math.round(v);
    })(),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Per Toko</h1>
        <ExportButtons report="performa-toko" />
      </div>
      <p className="text-sm text-gray-500">
        Perbandingan omzet, uang cair, dan profit per toko pada periode terpilih. Untuk melihat tren harian satu toko,
        pilih toko itu di filter atas lalu buka Dashboard.
      </p>

      <LeaderboardToko rows={rows} />

      <div className="card p-6">
        <p className="mb-3 text-sm font-semibold text-gray-800">Omzet &amp; Profit per Toko</p>
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300} debounce={150}>
            <BarChart data={chartData} barGap={4} barCategoryGap={18}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f1f4" vertical={false} />
              <XAxis dataKey="toko" tick={{ fontSize: 13, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 13, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatAxisShort(v)}
              />
              <Tooltip
                formatter={(v: unknown) => (typeof v === "number" ? formatRupiah(v) : "-")}
                contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 13 }}
                cursor={{ fill: "#f5f5f5" /* = --color-brand-100 (globals.css) */ }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar isAnimationActive={false} dataKey="Omzet" fill="#0a0a0a" /* = --color-brand-600, sama dgn Omzet di AreaTrendCard */ radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Profit HPP" fill="#a3a3a3" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <DataTable
        rowKey={(r: any) => r.toko}
        rows={rows}
        columns={[
          { header: "Toko", render: (r) => r.toko },
          { header: "Order", render: (r) => formatNumber(r.order) },
          { header: "Unit Keluar", render: (r) => formatNumber(r.unitKeluar) },
          { header: "Omzet Pesanan", render: (r) => formatRupiah(r.omzet) },
          // T-013 batch 13: per toko tetap berbasis pesanan periode ini (basis profit), label diperjelas.
          { header: "Uang Cair Pesanan Periode Ini", render: (r) => formatRupiah(r.uangCair) },
          { header: "Mengambang", render: (r) => formatRupiah(r.uangMengambang) },
          // T-013 temuan QA 2: toko yang HPP-nya seluruhnya tidak diketahui -> "-" (bukan "Rp 0").
          { header: "Profit HPP", render: (r) => formatRupiahOrDash(shownProfitHpp(r)) },
          { header: "Profit Agen", render: (r) => formatRupiahOrDash(shownProfitAgen(r)) },
        ]}
      />
      <TanpaHppNote tanpaHpp={sumTanpaHpp(rows)} />
    </div>
  );
}
