import type { Anomaly } from "@/lib/aiAnomalyCheck";

const SEVERITY_STYLE: Record<string, { badge: string; row: string; label: string }> = {
  high: { badge: "bg-rose-500 text-white", row: "border-rose-200 bg-rose-50", label: "Tinggi" },
  medium: { badge: "bg-amber-500 text-white", row: "border-amber-200 bg-amber-50", label: "Sedang" },
  low: { badge: "bg-gray-400 text-white", row: "border-gray-200 bg-gray-50", label: "Rendah" },
};

/**
 * Panel peringatan hasil AI Anomaly Check — tampil setelah upload/import selesai kalau
 * ada anomali terdeteksi. Data yang sudah diupload TETAP tersimpan di DB (tidak
 * auto-rollback); panel ini murni informasi supaya admin bisa cek lalu Edit/Delete
 * manual baris yang bermasalah lewat fitur CRUD yang sudah ada.
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
  if (aiCheckSkipped && anomalies.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Pemeriksaan AI Anomaly Check dilewati (API tidak tersedia saat ini) — data tetap tersimpan seperti biasa.
      </div>
    );
  }

  if (anomalies.length === 0) return null;

  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const outerStyle = highCount > 0 ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50";

  return (
    <div className={`mt-3 rounded-xl border p-3 ${outerStyle}`}>
      <p className="text-sm font-semibold text-gray-800">
        ⚠ AI Anomaly Check menemukan {anomalies.length} potensi anomali
      </p>
      {summary && <p className="mt-1 text-xs text-gray-600">{summary}</p>}
      <p className="mt-1 text-xs text-gray-500">
        Data sudah tersimpan seperti biasa — ini hanya informasi. Cek baris di bawah, lalu gunakan fitur Edit/Delete kalau perlu.
      </p>
      <ul className="mt-2 space-y-1.5">
        {anomalies.map((a, i) => {
          const style = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low;
          return (
            <li key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs ${style.row}`}>
              <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                {style.label}
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
  );
}
