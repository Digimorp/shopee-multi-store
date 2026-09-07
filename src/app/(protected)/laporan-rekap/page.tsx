"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import ExportButtons from "@/components/ExportButtons";
import { formatRupiah } from "@/lib/format";

export default function LaporanRekapPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "all";
  const [type, setType] = useState<"monthly" | "yearly">("monthly");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/reports/recap?type=${type}&storeId=${storeId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []));
  }, [type, storeId]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Laporan Rekapan & Cut-Off Period</h1>
      <p className="text-sm text-gray-500">
        Rekap bulanan mengikuti siklus cut-off (tgl 26 s/d tgl 25). Komparasi menunjukkan selisih omzet vs periode
        sebelumnya.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setType("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm ${type === "monthly" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Bulanan (Cut-Off & Komparasi)
          </button>
          <button
            onClick={() => setType("yearly")}
            className={`rounded-md px-3 py-1.5 text-sm ${type === "yearly" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Tahunan (Multi-Toko)
          </button>
        </div>
        <ExportButtons report="recap" params={{ type }} />
      </div>

      {type === "monthly" ? (
        <DataTable
          rowKey={(r: any) => r.periodKey}
          rows={rows}
          columns={[
            { header: "Periode Cut-Off", render: (r) => r.label },
            { header: "Omzet", render: (r) => formatRupiah(r.omzet) },
            { header: "Profit HPP", render: (r) => formatRupiah(r.profitHpp) },
            {
              header: "Selisih vs Periode Lalu",
              render: (r) => (
                <span className={r.deltaOmzet >= 0 ? "text-green-600" : "text-red-600"}>
                  {r.deltaOmzet >= 0 ? "▲" : "▼"} {formatRupiah(Math.abs(r.deltaOmzet))} ({r.deltaPct.toFixed(1)}%)
                </span>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          rowKey={(r: any) => r.year}
          rows={rows}
          columns={[
            { header: "Tahun", render: (r) => r.year },
            { header: "Omzet", render: (r) => formatRupiah(r.omzet) },
            { header: "Profit HPP", render: (r) => formatRupiah(r.profitHpp) },
          ]}
        />
      )}
    </div>
  );
}
