"use client";

import { useState } from "react";
import type { Anomaly } from "@/lib/aiAnomalyCheck";

const SEVERITY_STYLE: Record<string, { badge: string; row: string; label: string; rank: number }> = {
  high: { badge: "bg-rose-500 text-white", row: "border-rose-200 bg-rose-50", label: "Tinggi", rank: 3 },
  medium: { badge: "bg-amber-500 text-white", row: "border-amber-200 bg-amber-50", label: "Sedang", rank: 2 },
  low: { badge: "bg-gray-400 text-white", row: "border-gray-200 bg-gray-50", label: "Rendah", rank: 1 },
};

/**
 * Panel peringatan hasil AI Anomaly Check — tampil setelah upload/import selesai kalau
 * ada anomali terdeteksi. Default collapsed (cuma badge ringkas) supaya tidak mendorong
 * layout form; detail per baris baru muncul kalau admin klik expand. Data yang sudah
 * diupload TETAP tersimpan di DB (tidak auto-rollback) — panel ini murni informasi.
 */
export default function AiAnomalyPanel({
  anomalies,
  summary,
  aiCheckSkipped,
}: {
  anomalies: Anomaly[];
  summary?: string;
  aiCheckSkipped?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (aiCheckSkipped && anomalies.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Pemeriksaan AI Anomaly Check dilewati (API tidak tersedia saat ini) — data tetap tersimpan seperti biasa.
      </div>
    );
  }

  if (anomalies.length === 0) return null;

  const highestSeverity = anomalies.reduce(
    (acc, a) => (SEVERITY_STYLE[a.severity].rank > SEVERITY_STYLE[acc].rank ? a.severity : acc),
    anomalies[0].severity
  );
  const style = SEVERITY_STYLE[highestSeverity] ?? SEVERITY_STYLE.low;

  return (
    <div className={`mt-3 rounded-xl border ${style.row}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
            {style.label}
          </span>
          ⚠ {anomalies.length} potensi anomali terdeteksi
        </span>
        <span className="shrink-0 text-xs text-gray-500">{expanded ? "Sembunyikan ▲" : "Lihat detail ▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-inherit px-3 pb-3 pt-2">
          {summary && <p className="mb-2 text-xs text-gray-600">{summary}</p>}
          <p className="mb-2 text-xs text-gray-500">
            Data sudah tersimpan seperti biasa — ini hanya informasi. Cek baris di bawah, lalu gunakan fitur Edit/Delete kalau perlu.
          </p>
          <ul className="space-y-1.5">
            {anomalies.map((a, i) => {
              const rowStyle = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low;
              return (
                <li key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs ${rowStyle.row}`}>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${rowStyle.badge}`}>
                    {rowStyle.label}
                  </span>
                  <span className="font-medium text-gray-700">{a.rowRef}</span>
                  <span className="text-gray-400"> · {a.field} — </span>
                  <span className="text-gray-600">{a.message}</span>
                </li>
              );
            })}
          </ul>
          {aiCheckSkipped && (
            <p className="mt-2 text-[11px] text-gray-400">
              Catatan: pemeriksaan AI tidak selesai penuh (fallback ke pemeriksaan statistik lokal) — anomali di atas mungkin belum lengkap.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
