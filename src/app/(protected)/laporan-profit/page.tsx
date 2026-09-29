"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import { formatRupiah, formatNumber } from "@/lib/format";

type SortKey = "profitHpp" | "qty";

export default function LaporanProfitPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<any>({ rows: [], summary: {} });
  const [sortKey, setSortKey] = useState<SortKey>("profitHpp");

  useEffect(() => {
    fetch(`/api/reports/profit?${qs}`).then((r) => r.json()).then(setData);
  }, [qs]);

  const rows: any[] = data.rows ?? [];
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sortKey === "profitHpp" ? b.profitHpp - a.profitHpp : b.qty - a.qty)),
    [rows, sortKey]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Laporan Profit & Barang Keluar</h1>
        <ExportButtons report="profit" />
      </div>

      <p className="text-xs text-gray-500">
        Unit Keluar/Omzet Bruto/Uang Cair &amp; Kontribusi Omzet dihitung dari pesanan <strong>berstatus Selesai</strong>.
        Profit HPP (Nett) = Uang Cair Shopee − HPP. Profit Agen = (Harga Katalog × 50%) − HPP, direalisasi juga saat
        Belum Cair. Selisih menunjukkan potensi gap antara harga jual ke agen dan penerimaan riil dari Shopee.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon="box" accent="green" label="Total Unit Keluar" value={formatNumber(data.summary?.totalQty ?? 0)} />
        <SummaryCard icon="tag" accent="blue" label="Jumlah SKU Terjual" value={formatNumber(data.summary?.skuCount ?? 0)} />
        <SummaryCard icon="coins" accent="orange" label="Total Uang Cair" value={formatRupiah(data.summary?.totalUangCair ?? 0)} />
        <SummaryCard icon="trendingUp" accent="green" label="Total Profit HPP (Nett)" value={formatRupiah(data.summary?.totalProfitHpp ?? 0)} />
        <SummaryCard icon="wallet" accent="purple" label="Total Profit Agen" value={formatRupiah(data.summary?.totalProfitAgen ?? 0)} />
        <SummaryCard
          icon="scale"
          label="Selisih Agen vs Riil"
          value={formatRupiah(data.summary?.selisih ?? 0)}
          accent={(data.summary?.selisih ?? 0) >= 0 ? "green" : "red"}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setSortKey("profitHpp")}
          className={`tab-pill ${sortKey === "profitHpp" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Urutkan: Profit HPP
        </button>
        <button
          onClick={() => setSortKey("qty")}
          className={`tab-pill ${sortKey === "qty" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Urutkan: Unit Terjual
        </button>
      </div>

      <DataTable
        rowKey={(r: any) => r.sku}
        rows={sorted}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => <span className="block max-w-[200px] truncate">{r.name}</span> },
          { header: "Unit Keluar", render: (r) => formatNumber(r.qty) },
          { header: "Kontribusi Omzet", render: (r) => `${((r.share ?? 0) * 100).toFixed(1)}%` },
          { header: "Omzet Bruto", render: (r) => formatRupiah(r.omzet) },
          { header: "Uang Cair", render: (r) => formatRupiah(r.uangCair) },
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
