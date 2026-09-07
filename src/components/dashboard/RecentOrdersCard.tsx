"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { Icon } from "@/components/icons";
import { formatDate, formatNumber } from "@/lib/format";

const PER = 8;

export default function RecentOrdersCard() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [all, setAll] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetch(`/api/orders?${qs}&page=1`)
      .then((r) => r.json())
      .then((d) => {
        setAll(d.orders ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [qs]);

  const totalPages = Math.max(1, Math.ceil(all.length / PER));
  const rows = useMemo(() => all.slice((page - 1) * PER, page * PER), [all, page]);

  return (
    <div className="card p-5">
      <div>
        <p className="text-sm font-semibold text-gray-800">Pesanan Terbaru</p>
        <p className="text-xs text-gray-400">
          {formatNumber(total)} pesanan pada periode ini{total > all.length ? ` · menampilkan ${all.length} terbaru` : ""}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-3">Tanggal</th>
              <th className="py-2 pr-3">No. Pesanan</th>
              <th className="py-2 pr-3">Toko</th>
              <th className="py-2 pr-3">Produk</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  Belum ada pesanan.
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id} className="hover:bg-brand-50/40">
                  <td className="whitespace-nowrap py-2.5 pr-3 text-gray-500">{formatDate(o.orderCreatedAt)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-gray-700">{o.orderSn}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-gray-500">{o.store?.code}</td>
                  <td className="max-w-[180px] truncate py-2.5 pr-3 text-gray-700">{o.productName}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">{o.qty}</td>
                  <td className="py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>
          Halaman {page} dari {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:enabled:border-brand-300 hover:enabled:text-brand-500 disabled:opacity-40"
          >
            <Icon name="arrowRight" size={14} className="rotate-180" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:enabled:border-brand-300 hover:enabled:text-brand-500 disabled:opacity-40"
          >
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
