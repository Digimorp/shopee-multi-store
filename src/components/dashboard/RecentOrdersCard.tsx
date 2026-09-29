"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
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
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    const res = await fetch(`/api/orders/${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "Gagal menghapus pesanan.");
      return;
    }
    setDeleting(null);
    load(page);
  }

  return (
    <div className="card p-5">
      <div>
        <p className="text-sm font-semibold text-gray-800">Pesanan Terbaru</p>
        <p className="text-xs text-gray-400">{formatNumber(total)} pesanan pada periode ini</p>
      </div>

      <div className="mt-4">
        <DataTable
          rowKey={(r: any) => r.id}
          rows={rows}
          emptyText={loading ? "Memuat…" : "Belum ada pesanan."}
          serverPagination={{ page, totalPages, onPageChange: changePage }}
          columns={[
            { header: "Tanggal", render: (r) => formatDate(r.orderCreatedAt) },
            { header: "No. Pesanan", render: (r) => <span className="font-medium text-gray-700">{r.orderSn}</span> },
            { header: "Toko", render: (r) => r.store?.code },
            { header: "Produk", render: (r) => <span className="block max-w-[180px] truncate">{r.productName}</span> },
            { header: "Qty", render: (r) => r.qty, className: "text-right" },
            { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            {
              header: "Aksi",
              render: (r) => (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(r)} className="btn-chip" title="Edit">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleting(r);
                      setDeleteError("");
                    }}
                    className="btn-chip btn-chip-danger"
                    title="Hapus"
                  >
                    Hapus
                  </button>
                </div>
              ),
            },
          ]}
        />
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

      {deleting && (
        <ConfirmDialog
          title={`Hapus pesanan ${deleting.orderSn}?`}
          message="Aksi ini bisa dibatalkan lewat log admin (data tidak dihapus permanen dari database, hanya disembunyikan dari laporan)."
          strongWarning={deleteError || undefined}
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
