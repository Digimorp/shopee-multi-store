"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import { formatRupiah, formatNumber } from "@/lib/format";

export default function LaporanBarangKeluarPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<any>({ all: [], totalQty: 0, skuCount: 0 });

  useEffect(() => {
    fetch(`/api/dashboard/top-products?${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d));
  }, [qs]);

  const rows: any[] = data.all ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Analisis Barang Keluar</h1>
        <ExportButtons report="barang-keluar" />
      </div>
      <p className="text-sm text-gray-500">
        Total unit terjual per SKU, <strong>hanya pesanan berstatus Selesai (uang cair)</strong>, diurutkan dari yang
        paling laku. Dipakai untuk ranking produk & keputusan restok.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon="box" accent="green" label="Total Unit Keluar" value={formatNumber(data.totalQty ?? 0)} />
        <SummaryCard icon="tag" accent="blue" label="Jumlah SKU Terjual" value={formatNumber(data.skuCount ?? 0)} />
        <SummaryCard
          icon="coins"
          accent="orange"
          label="Total Uang Cair"
          value={formatRupiah(rows.reduce((s, r) => s + (r.uangCair ?? 0), 0))}
        />
      </div>

      <DataTable
        rowKey={(r: any) => r.sku}
        rows={rows}
        emptyText="Belum ada pesanan Selesai pada periode & toko ini."
        columns={[
          { header: "#", render: (r) => r.rank },
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.name },
          { header: "Unit Keluar", render: (r) => formatNumber(r.qty) },
          { header: "Kontribusi", render: (r) => `${((r.share ?? 0) * 100).toFixed(1)}%` },
          { header: "Omzet Bruto", render: (r) => formatRupiah(r.omzet) },
          { header: "Uang Cair", render: (r) => formatRupiah(r.uangCair) },
          { header: "Profit HPP", render: (r) => formatRupiah(r.profitHpp) },
        ]}
      />
    </div>
  );
}
