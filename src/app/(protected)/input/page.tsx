"use client";

import { useEffect, useState } from "react";
import UploadForm from "@/components/UploadForm";
import DataTable from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDate, formatNumber } from "@/lib/format";
import type { StoreOption } from "@/types";

export default function InputPage() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [incomeImports, setIncomeImports] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function loadLogs() {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
    fetch("/api/income/imports")
      .then((r) => r.json())
      .then((d) => setIncomeImports(d.imports ?? []));
  }

  useEffect(() => {
    fetch("/api/stores").then((r) => r.json()).then((d) => setStores(d.stores ?? []));
    loadLogs();
  }, []);

  async function confirmDeleteImport(reason?: string) {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    const res = await fetch(`/api/income/imports/${deleting.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setDeleteBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "Gagal menghapus import.");
      if (d.inUse) setNeedsReason(true);
      return;
    }
    setDeleting(null);
    setNeedsReason(false);
    loadLogs();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Input & Import Data</h1>

      <UploadForm
        stores={stores}
        onDone={loadLogs}
        endpoint="/api/upload"
        title="1. Laporan Pesanan Shopee"
        fileLabel="File export Pesanan (.xlsx / .csv)"
        submitLabel="Upload & Proses Pesanan"
        hint="Klasifikasi status (Batal / Retur / Transit / Belum Cair / Selesai) + hitung profit estimasi berdasarkan Master HPP."
      />

      <UploadForm
        stores={stores}
        onDone={loadLogs}
        endpoint="/api/income/import"
        title="2. Income Report / Laporan Pendapatan Shopee"
        fileLabel="File Laporan Pendapatan / Rilis Dana (.xlsx / .csv)"
        submitLabel="Upload & Proses Income Report"
        hint="Sumber kebenaran uang cair AKTUAL (Keuangan > Saldo Penghasilan). 1 file = 1 toko. Import ulang periode yang sama = versi baru (data lama tidak ditimpa)."
        formatResult={(d) =>
          `Berhasil: ${d.orderRows} baris order + ${d.adjustmentRows} adjustment (v${d.version}).` +
          (d.supersededCount > 0 ? ` ${d.supersededCount} import lama ditandai kadaluarsa.` : "") +
          (d.parseErrors?.length ? ` ${d.parseErrors.length} baris error.` : "")
        }
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-800">Riwayat Import Pesanan</h2>
        <DataTable
          rowKey={(r: any) => r.id}
          rows={logs}
          columns={[
            { header: "Tanggal", render: (r) => formatDate(r.createdAt) },
            { header: "Toko", render: (r) => `${r.store.code} - ${r.store.name}` },
            { header: "Admin", render: (r) => r.admin.name },
            { header: "Nama File", render: (r) => r.fileName },
            { header: "Total Baris", render: (r) => r.totalRows },
            { header: "Sukses", render: (r) => r.successRows },
            { header: "Gagal/Dilewati", render: (r) => r.failedRows },
          ]}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-800">Riwayat Import Income Report</h2>
        <DataTable
          rowKey={(r: any) => r.id}
          rows={incomeImports}
          emptyText="Belum ada Income Report diimpor."
          columns={[
            { header: "Tanggal", render: (r) => formatDate(r.createdAt) },
            { header: "Toko", render: (r) => r.store },
            { header: "Nama File", render: (r) => r.fileName },
            { header: "Periode", render: (r) => (r.periodStart ? `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}` : "—") },
            { header: "Baris Order", render: (r) => formatNumber(r.orderRows) },
            { header: "Adjustment", render: (r) => formatNumber(r.adjustmentRows) },
            { header: "Versi", render: (r) => `v${r.version}` },
            {
              header: "Status",
              render: (r) =>
                r.isDeleted ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-600">dihapus</span>
                ) : r.isSuperseded ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">kadaluarsa</span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">aktif</span>
                ),
            },
            {
              header: "Aksi",
              render: (r) =>
                r.isDeleted ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  <button
                    onClick={() => {
                      setDeleting(r);
                      setDeleteError("");
                      setNeedsReason(false);
                    }}
                    className="btn-chip btn-chip-danger"
                  >
                    Hapus
                  </button>
                ),
            },
          ]}
        />
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Hapus import "${deleting.fileName}"?`}
          message="Aksi ini bisa dibatalkan lewat log admin (import tidak dihapus permanen dari database, hanya disembunyikan dan tidak lagi dipakai Rekonsiliasi)."
          strongWarning={deleteError || undefined}
          requireReason={needsReason}
          busy={deleteBusy}
          onConfirm={confirmDeleteImport}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
