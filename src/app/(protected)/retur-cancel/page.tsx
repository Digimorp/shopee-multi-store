"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatRupiah } from "@/lib/format";

export default function ReturCancelPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [tab, setTab] = useState<"cancel" | "retur">("retur");
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  function load() {
    const status = tab === "cancel" ? "CANCEL" : "RETUR";
    fetch(`/api/orders?${qs}&status=${status}`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders ?? []);
        setTotal(d.total ?? 0);
      });
  }

  useEffect(load, [qs, tab]);

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
      <h1 className="text-lg font-semibold text-gray-900">Pembatalan & Retur</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("cancel")}
          className={`rounded-md px-3 py-1.5 text-sm ${tab === "cancel" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          Cancel (Batal)
        </button>
        <button
          onClick={() => setTab("retur")}
          className={`rounded-md px-3 py-1.5 text-sm ${tab === "retur" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          Retur (Pengembalian)
        </button>
      </div>

      <SummaryCard label={`Total Transaksi ${tab === "cancel" ? "Batal" : "Retur"}`} value={String(total)} accent="red" />

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
                { header: "Beban Kerugian HPP", render: (r: any) => (r.returCondition === "DAMAGED" ? formatRupiah(r.hppSnapshot * r.qty) : "-") },
              ]
            : []),
        ]}
      />
    </div>
  );
}
