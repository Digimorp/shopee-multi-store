"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import ExportButtons from "@/components/ExportButtons";
import { formatDate, formatRupiah, formatNumber } from "@/lib/format";

export default function ReturCancelPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [tab, setTab] = useState<"cancel" | "retur">("retur");
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(() => {
    const status = tab === "cancel" ? "CANCEL" : "RETUR";
    fetch(`/api/orders?${qs}&status=${status}`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders ?? []);
        setTotal(d.total ?? 0);
      });
    fetch(`/api/reports/returns?${qs}`)
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? null));
  }, [qs, tab]);

  useEffect(load, [load]);

  async function handleAction(id: string, condition: "GOOD" | "DAMAGED") {
    await fetch(`/api/orders/${id}/retur`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Analisis Retur & Pembatalan</h1>
        <ExportButtons report="retur" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Unit Batal" value={formatNumber(summary?.batal?.unit ?? 0)} accent="red" />
        <SummaryCard label="Unit Retur" value={formatNumber(summary?.retur?.unit ?? 0)} accent="red" />
        <SummaryCard label="Retur Layak Restok (unit)" value={formatNumber(summary?.layakRestok?.unit ?? 0)} accent="green" />
        <SummaryCard label="Retur Rusak (unit)" value={formatNumber(summary?.rusak?.unit ?? 0)} accent="red" />
        <SummaryCard label="Beban Kerugian HPP" value={formatRupiah(summary?.rusak?.kerugianHpp ?? 0)} accent="red" />
      </div>
      {summary?.belumDiklasifikasi?.unit > 0 && (
        <p className="text-xs text-amber-700">
          {formatNumber(summary.belumDiklasifikasi.unit)} unit retur belum diklasifikasi (Bagus/Rusak) — tandai di tabel
          bawah agar kerugian HPP akurat.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setTab("retur")}
          className={`tab-pill ${tab === "retur" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Retur (Pengembalian)
        </button>
        <button
          onClick={() => setTab("cancel")}
          className={`tab-pill ${tab === "cancel" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Cancel (Batal)
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Menampilkan {orders.length} dari {total} transaksi {tab === "cancel" ? "batal" : "retur"} pada periode & toko terpilih.
      </p>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={orders}
        columns={[
          { header: "Tanggal", render: (r) => formatDate(r.orderCreatedAt) },
          { header: "Toko", render: (r) => r.store.code },
          { header: "No. Pesanan", render: (r) => r.orderSn },
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.productName },
          { header: "Qty", render: (r) => r.qty },
          { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ...(tab === "retur"
            ? [
                {
                  header: "Kondisi Barang",
                  render: (r: any) =>
                    r.returCondition ? (
                      <span className={r.returCondition === "GOOD" ? "text-green-600" : "text-red-600"}>
                        {r.returCondition === "GOOD" ? "Bagus - Restok" : "Rusak/Cacat"}
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAction(r.id, "GOOD")}
                          className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200"
                        >
                          Restok Gudang
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "DAMAGED")}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                        >
                          Barang Rusak/Cacat
                        </button>
                      </div>
                    ),
                },
                {
                  header: "Beban Kerugian HPP",
                  render: (r: any) => (r.returCondition === "DAMAGED" ? formatRupiah(r.hppSnapshot * r.qty) : "-"),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
