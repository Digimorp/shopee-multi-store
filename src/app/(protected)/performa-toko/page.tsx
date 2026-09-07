"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import DataTable from "@/components/DataTable";
import ExportButtons from "@/components/ExportButtons";
import { formatRupiah, formatNumber } from "@/lib/format";

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
    "Profit HPP": Math.round(r.profitHpp),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Performa Toko</h1>
        <ExportButtons report="performa-toko" />
      </div>
      <p className="text-sm text-gray-500">
        Perbandingan omzet, uang cair, dan profit per toko pada periode terpilih. Untuk melihat tren harian satu toko,
        pilih toko itu di filter atas lalu buka Dashboard.
      </p>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-gray-800">Omzet &amp; Profit per Toko</p>
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300} debounce={150}>
            <BarChart data={chartData} barGap={4} barCategoryGap={18}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f1f4" vertical={false} />
              <XAxis dataKey="toko" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(v: number) => formatRupiah(v)}
                contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}
                cursor={{ fill: "#fce7f3" }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="Omzet" fill="#ec4899" radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Profit HPP" fill="#a855f7" radius={[6, 6, 0, 0]} />
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
          { header: "Omzet Bruto", render: (r) => formatRupiah(r.omzet) },
          { header: "Uang Cair", render: (r) => formatRupiah(r.uangCair) },
          { header: "Mengambang", render: (r) => formatRupiah(r.uangMengambang) },
          { header: "Profit HPP", render: (r) => formatRupiah(r.profitHpp) },
          { header: "Profit Agen", render: (r) => formatRupiah(r.profitAgen) },
        ]}
      />
    </div>
  );
}
