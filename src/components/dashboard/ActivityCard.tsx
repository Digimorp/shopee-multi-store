"use client";

import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function ActivityCard({
  logs,
  loading,
  error = false,
}: {
  logs: any[];
  loading: boolean;
  error?: boolean;
}) {
  return (
    <div className="card p-6">
      <p className="text-sm font-semibold text-gray-800">Aktivitas Terbaru</p>
      <p className="text-xs text-gray-400">Riwayat impor data pesanan</p>

      <div className="mt-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">Memuat…</p>
        ) : error && logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-amber-600">Gagal memuat aktivitas.</p>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Belum ada aktivitas impor.</p>
        ) : (
          <ul className="space-y-4">
            {logs.slice(0, 6).map((l, i) => {
              const failed = (l.failedRows ?? 0) > 0;
              return (
                <li key={l.id ?? i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{l.store?.code ?? "-"}</p>
                    <p className="break-words text-xs text-gray-500">
                      {l.successRows} baris pesanan diimpor{failed ? ` (${l.failedRows} dilewati)` : ""} · {l.fileName} ·{" "}
                      {l.createdAt
                        ? formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      failed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {failed ? "Ada dilewati" : "Berhasil"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
