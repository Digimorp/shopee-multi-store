"use client";

import { useEffect, useState } from "react";
import UploadForm from "@/components/UploadForm";
import DataTable from "@/components/DataTable";
import { formatDate } from "@/lib/format";
import type { StoreOption } from "@/types";

export default function InputPage() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  function loadLogs() {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }

  useEffect(() => {
    fetch("/api/stores").then((r) => r.json()).then((d) => setStores(d.stores ?? []));
    loadLogs();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Input & Import Data</h1>
      <p className="text-sm text-gray-500">
        Upload file export pesanan Shopee (Excel/CSV) dari Seller Centre. Sistem akan otomatis mengklasifikasi status
        pesanan (Batal, Retur, Transit, Belum Cair, Selesai) dan menghitung profit berdasarkan Master Data HPP.
      </p>

      <UploadForm stores={stores} onDone={loadLogs} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Log Riwayat Upload</h2>
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
    </div>
  );
}
