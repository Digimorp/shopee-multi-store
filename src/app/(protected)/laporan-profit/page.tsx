"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import { formatRupiah } from "@/lib/format";

export default function LaporanProfitPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<any>({ rows: [], summary: {} });

  useEffect(() => {
    fetch(`/api/reports/profit?${qs}`).then((r) => r.json()).then(setData);
  }, [qs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Laporan Profit</h1>
        <ExportButtons report="profit" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Profit HPP (Nett)" value={formatRupiah(data.summary?.totalProfitHpp ?? 0)} accent="green" />
        <SummaryCard label="Total Profit Agen" value={formatRupiah(data.summary?.totalProfitAgen ?? 0)} accent="blue" />
        <SummaryCard
          label="Selisih Agen vs Riil"
          value={formatRupiah(data.summary?.selisih ?? 0)}
          accent={(data.summary?.selisih ?? 0) >= 0 ? "green" : "red"}
        />
      </div>

      <p className="text-xs text-gray-500">
        Profit HPP (Nett) = Uang Cair Shopee − HPP. Profit Agen = (Harga Katalog × 50%) − HPP. Selisih menunjukkan
        potensi gap antara harga jual ke agen dan penerimaan riil dari Shopee.
      </p>

      <DataTable
        rowKey={(r: any) => r.sku}
        rows={data.rows ?? []}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.name },
          { header: "Qty Terjual", render: (r) => r.qty },
          { header: "Profit HPP", render: (r) => formatRupiah(r.profitHpp) },
          { header: "Profit Agen", render: (r) => formatRupiah(r.profitAgen) },
          {
            header: "Selisih",
            render: (r) => (
              <span className={r.selisih >= 0 ? "text-green-600" : "text-red-600"}>{formatRupiah(r.selisih)}</span>
            ),
          },
        ]}
      />
    </div>
  );
}
