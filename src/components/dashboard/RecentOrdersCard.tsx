"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageNav } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import OrderEditModal, { type OrderEditRow } from "@/components/OrderEditModal";
import { formatDate, formatNumber } from "@/lib/format";

const PAGE_SIZE = 50;

export default function RecentOrdersCard() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OrderEditRow | null>(null);

  function load(p: number) {
    setLoading(true);
    fetch(`/api/orders?${qs}&page=${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.orders ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  function changePage(p: number) {
    setPage(p);
    load(p);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="card p-6">
      <div>
        <p className="text-sm font-semibold text-gray-800">Pesanan Terbaru</p>
        <p className="text-xs text-gray-400">{formatNumber(total)} pesanan pada periode ini</p>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">{loading ? "Memuat…" : "Belum ada pesanan."}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.orderSn}</p>
                  <p className="break-words text-xs text-gray-500">
                    {formatDate(r.orderCreatedAt)} · {r.store?.code} · {r.productName} · Qty {r.qty}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={r.status} />
                  <button onClick={() => setEditing(r)} className="link-action" title="Lihat/Edit">
                    Lihat/Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-card-border pt-3">
            <span className="text-xs text-gray-400">
              Halaman {page} dari {totalPages}
            </span>
            <PageNav page={page} totalPages={totalPages} onChange={changePage} />
          </div>
        )}
      </div>

      {editing && (
        <OrderEditModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(page);
          }}
        />
      )}
    </div>
  );
}
