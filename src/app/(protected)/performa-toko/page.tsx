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
        <h1 className="text-lg font-semibold text-gray-900">Performa Toko</h1>
        <ExportButtons report="performa-toko" />
      </div>
      <p className="text-sm text-gray-500">
        Perbandingan omzet, uang cair, dan profit per toko pada periode terpilih. Untuk melihat tren harian satu toko,
        pilih toko itu di filter atas lalu buka Dashboard.
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="toko" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Legend />
              <Bar dataKey="Omzet" fill="#ee4d2d" />
              <Bar dataKey="Profit HPP" fill="#16a34a" />
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
