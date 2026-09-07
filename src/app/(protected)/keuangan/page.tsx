"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import { formatDate, formatRupiah } from "@/lib/format";

const TABS = [
  { key: "cair", label: "Uang Cair (Selesai)" },
  { key: "pending", label: "Uang Mengambang (Pending)" },
  { key: "transit", label: "Barang di Jalan (Transit)" },
];

export default function KeuanganPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [tab, setTab] = useState("cair");
  const [data, setData] = useState<any>({ orders: [], summary: {} });

  useEffect(() => {
    fetch(`/api/reports/cashflow?${qs}&tab=${tab}`)
      .then((r) => r.json())
      .then(setData);
  }, [qs, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Keuangan & Cashflow</h1>
        <ExportButtons report="cashflow" params={{ tab }} />
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-pill ${tab === t.key ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Jumlah Transaksi" value={String(data.summary?.count ?? 0)} />
        <SummaryCard label="Total Omzet Bruto" value={formatRupiah(data.summary?.totalGross ?? 0)} />
        <SummaryCard label="Total Nilai (Cair/Estimasi)" value={formatRupiah(data.summary?.totalNet ?? 0)} accent="green" />
      </div>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={data.orders ?? []}
        columns={[
          { header: "Tanggal", render: (r) => formatDate(r.orderCreatedAt) },
          { header: "Toko", render: (r) => r.store.code },
          { header: "No. Pesanan", render: (r) => r.orderSn },
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.productName },
          { header: "Qty", render: (r) => r.qty },
          { header: "Omzet Bruto", render: (r) => formatRupiah(r.grossOmzet) },
          { header: "Nilai", render: (r) => formatRupiah(r.netSettlement) },
        ]}
      />
    </div>
  );
}
