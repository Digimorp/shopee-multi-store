"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import StageBadge from "@/components/StageBadge";
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
  const [recon, setRecon] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/reports/cashflow?${qs}&tab=${tab}`)
      .then((r) => r.json())
      .then(setData);
  }, [qs, tab]);

  useEffect(() => {
    fetch(`/api/reconciliation?${qs}`)
      .then((r) => r.json())
      .then(setRecon)
      .catch(() => setRecon(null));
  }, [qs]);

  // Map No. Pesanan -> hasil rekonsiliasi (untuk label tahap + estimasi vs aktual)
  const reconMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const it of recon?.items ?? []) m.set(it.orderSn, it);
    return m;
  }, [recon]);

  const rows: any[] = data.orders ?? [];
  const aktualTotal = useMemo(
    () => rows.reduce((s, r) => s + (reconMap.get(r.orderSn)?.aktual ?? 0), 0),
    [rows, reconMap]
  );
  const nMatched = useMemo(() => rows.filter((r) => reconMap.get(r.orderSn)?.aktual != null).length, [rows, reconMap]);

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

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Jumlah Transaksi" value={String(data.summary?.count ?? 0)} />
        <SummaryCard label="Total Omzet Bruto" value={formatRupiah(data.summary?.totalGross ?? 0)} />
        <SummaryCard label="Total Nilai — ESTIMASI" value={formatRupiah(data.summary?.totalNet ?? 0)} accent="brand" />
        <SummaryCard
          label={`Total Nilai — AKTUAL (${nMatched} matched)`}
          value={formatRupiah(aktualTotal)}
          accent="green"
        />
      </div>
      {tab === "cair" && (
        <p className="text-xs text-gray-400">
          Kolom <strong>Estimasi</strong> = hitungan dari data Pesanan. <strong>Aktual</strong> = dari Income Report yang
          sudah di-match (lihat menu Rekonsiliasi Uang Cair). Baris kuning = &quot;Sampai&quot; &gt; 7 hari belum cair,
          kemungkinan retur pending.
        </p>
      )}

      <DataTable
        rowKey={(r: any) => r.id}
        rows={rows}
        columns={[
          { header: "Tanggal", render: (r) => formatDate(r.orderCreatedAt) },
          { header: "Toko", render: (r) => r.store.code },
          {
            header: "No. Pesanan",
            render: (r) => {
              const rc = reconMap.get(r.orderSn);
              const stuck = rc?.flags?.includes("SAMPAI_7H_BELUM_CAIR");
              return <span className={stuck ? "font-semibold text-amber-700" : ""}>{r.orderSn}</span>;
            },
          },
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => <span className="block max-w-[160px] truncate">{r.productName}</span> },
          { header: "Qty", render: (r) => r.qty },
          { header: "Estimasi", render: (r) => formatRupiah(r.netSettlement) },
          {
            header: "Aktual",
            render: (r) => {
              const a = reconMap.get(r.orderSn)?.aktual;
              return a == null ? <span className="text-gray-300">— belum</span> : formatRupiah(a);
            },
          },
          {
            header: "Tahap",
            render: (r) => {
              const rc = reconMap.get(r.orderSn);
              return rc ? <StageBadge stage={rc.stage} /> : <span className="text-gray-300">—</span>;
            },
          },
        ]}
      />
    </div>
  );
}
