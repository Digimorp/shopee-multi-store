// Stat card khusus Dashboard (redesign monokrom): card putih berborder tipis, angka besar bold
// hitam, label abu-abu kecil, tanpa ikon. Warna HANYA muncul sebagai titik indikator status
// (hijau = cair, oranye = belum cair, merah = perlu dicek) — bukan di angka atau ikon.
// Angka negatif tetap merah karena itu sinyal fungsional (rugi), bukan dekorasi.
//
// Sengaja komponen terpisah dari SummaryCard: SummaryCard dipakai 6 halaman lain yang belum
// masuk scope redesign. Tampilan card (border/shadow) ikut tema lewat class `theme-mono` di induknya.
const DOT = {
  neutral: null,
  success: "bg-emerald-500",
  warning: "bg-orange-500",
  danger: "bg-rose-500",
} as const;

export default function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  negative = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof DOT;
  /** true = angka merah (mis. profit bernilai negatif). */
  negative?: boolean;
}) {
  const dot = DOT[tone];
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        {dot && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
      </div>
      {/* Nominal rupiah tidak boleh terpotong: lebih baik turun baris daripada truncate. */}
      <p
        className={`mt-3 break-words text-3xl font-bold leading-tight tabular-nums ${
          negative ? "text-rose-600" : "text-neutral-950"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
