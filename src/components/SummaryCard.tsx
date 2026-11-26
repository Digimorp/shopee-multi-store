// Badge peringkat bulat bernomor (1/2/3…) — gaya flat, warna aksen hijau brand.
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold tabular-nums text-accent-text">
      {rank}
    </span>
  );
}

// Warna angka mengikuti MAKNA metrik, bukan variasi per kartu.
// Pakai varian `-text` dari token (bukan DEFAULT): angka ini duduk di atas kartu putih, dan warning
// DEFAULT (mustard) di atas putih hanya ~1,8:1, sedangkan warning-text 5,4:1.
const TONES = {
  neutral: "text-ink", // total, jumlah, dsb.
  success: "text-success-text", // berhasil / selesai / cair
  warning: "text-warning-text", // pending / menunggu / retur
  danger: "text-danger-text", // gagal / rugi / perlu dicek
} as const;

// Stat card baku untuk semua halaman: label kecil uppercase + angka besar, tanpa ikon.
// Angka sengaja tidak di-truncate: nominal rupiah tidak boleh terpotong, lebih baik turun baris.
export default function SummaryCard({
  label,
  value,
  sub,
  tone = "neutral",
  negative = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TONES;
  /** true = angka merah apa pun tone-nya (mis. selisih/profit bernilai negatif). */
  negative?: boolean;
}) {
  return (
    <div className="card p-5 sm:p-6">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`num mt-2 break-words text-[28px] font-bold leading-tight ${TONES[negative ? "danger" : tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
