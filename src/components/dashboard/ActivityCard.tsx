"use client";

import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Icon } from "@/components/icons";

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
    <div className="card p-5">
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
                <li key={l.id ?? i} className="flex gap-3">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      failed ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    <Icon name={failed ? "cloudUp" : "check"} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">{l.store?.code ?? "-"}</span> · {l.successRows} baris
                      pesanan diimpor{failed ? ` (${l.failedRows} dilewati)` : ""}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">
                      {l.fileName} ·{" "}
                      {l.createdAt
                        ? formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })
                        : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
