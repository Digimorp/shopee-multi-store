"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";

const ENTITY_TYPES = ["Order", "IncomeImport", "Product", "User", "Store", "StatusMapping"] as const;

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    fetch(`/api/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, entityType, action]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Log Aktivitas Admin</h1>
      <p className="text-sm text-gray-500">
        Riwayat semua aksi Edit &amp; Delete pada data Pesanan, Income Report, Master Produk, User, Toko, dan Mapping
        Status — siapa mengubah apa, kapan, dan alasannya (kalau ada). Data yang dihapus tetap ada di database, hanya
        disembunyikan dari listing.
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">Semua Tabel</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">Semua Aksi</option>
          <option value="EDIT">Edit</option>
          <option value="DELETE">Delete</option>
        </select>
      </div>

      <p className="text-xs text-gray-400">
        {loading ? "Memuat…" : `Menampilkan ${logs.length} dari ${total} log`}
      </p>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={logs}
        emptyText={loading ? "Memuat…" : "Belum ada log aktivitas."}
        columns={[
          { header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
          { header: "Aksi", render: (r) => (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.action === "DELETE" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
              {r.action === "DELETE" ? "Delete" : "Edit"}
            </span>
          ) },
          { header: "Tabel", render: (r) => r.entityType },
          { header: "Data", render: (r) => <span className="max-w-[160px] truncate block">{r.entityLabel}</span> },
          { header: "Oleh", render: (r) => `${r.actorName} (${r.actorRole === "OWNER" ? "Owner" : "Admin Toko"})` },
          { header: "Alasan", render: (r) => r.reason ?? <span className="text-gray-300">—</span> },
          {
            header: "Detail",
            render: (r) => (
              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-xs text-brand-600 hover:underline">
                {expanded === r.id ? "Sembunyikan" : "Lihat"}
              </button>
            ),
          },
        ]}
      />

      {expanded && (
        <div className="card p-4">
          {(() => {
            const r = logs.find((l) => l.id === expanded);
            if (!r) return null;
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Sebelum</p>
                  <pre className="max-h-60 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] text-gray-600">
                    {r.before ? JSON.stringify(r.before, null, 2) : "-"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Sesudah</p>
                  <pre className="max-h-60 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] text-gray-600">
                    {r.after ? JSON.stringify(r.after, null, 2) : "-"}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Halaman {page} dari {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  );
}
