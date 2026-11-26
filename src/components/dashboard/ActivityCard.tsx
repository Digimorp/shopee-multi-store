"use client";

import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatNumber } from "@/lib/format";

// `self-start` mencegah panel ikut melar setinggi daftar di sebelahnya; `lg:sticky` membuatnya tetap terlihat.
// T-013 batch 18 (Kaca Lembut): panel = kartu kaca bersama (.card); tile = putih hampir penuh.
const PANEL = "card self-start p-5 sm:p-6 lg:sticky lg:top-6";

const TILE = "rounded-2xl bg-white/85 px-4 py-3.5 ring-1 ring-ink/[0.05]";

function Note({ tone = "muted", children }: { tone?: "muted" | "error"; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-2xl bg-white/60 px-4 py-8 text-center text-sm ring-1 ring-black/[0.04] ${
        tone === "error" ? "text-amber-700" : "text-muted"
      }`}
    >
      {children}
    </p>
  );
}

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
    <div className={PANEL}>
      <h2 className="text-base font-bold text-ink">Aktivitas Terbaru</h2>
      <p className="mt-0.5 text-xs text-muted">Riwayat impor data pesanan</p>

      <div className="mt-5">
        {loading ? (
          <Note>Memuat…</Note>
        ) : error && logs.length === 0 ? (
          <Note tone="error">Gagal memuat aktivitas.</Note>
        ) : logs.length === 0 ? (
          <Note>Belum ada aktivitas impor.</Note>
        ) : (
          <ul className="space-y-3">
            {logs.slice(0, 6).map((l, i) => {
              const failed = (l.failedRows ?? 0) > 0;
              return (
                <li key={l.id ?? i} className={TILE}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">{l.store?.code ?? "-"}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        failed
                          ? "bg-amber-50 text-amber-700 ring-amber-600/15"
                          : "bg-success-bg text-success-text ring-success/15"
                      }`}
                    >
                      {failed ? "Ada dilewati" : "Berhasil"}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-muted">
                    {formatNumber(l.successRows ?? 0)} baris pesanan diimpor
                    {failed && <span className="font-medium text-amber-700"> · {formatNumber(l.failedRows)} dilewati</span>}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span
                      title={l.fileName}
                      className="min-w-0 truncate rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs text-muted"
                    >
                      {l.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {l.createdAt
                        ? formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })
                        : ""}
                    </span>
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
