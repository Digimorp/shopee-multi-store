import { Icon, type IconName } from "@/components/icons";

// Chip ikon judul section (header LeaderboardToko) — flat, 1 warna aksen hijau brand.
export function StatIcon({ icon }: { icon: IconName }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">
      <Icon name={icon} size={20} strokeWidth={2} />
    </span>
  );
}

// Badge peringkat bulat bernomor (1/2/3…) — gaya flat & warna aksen sama dengan StatIcon.
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold tabular-nums text-brand-600">
      {rank}
    </span>
  );
}

// Warna angka mengikuti MAKNA metrik, bukan variasi per kartu.
const TONES = {
  neutral: "text-gray-900", // total, jumlah, dsb.
  success: "text-emerald-600", // berhasil / selesai / cair
  warning: "text-amber-600", // pending / menunggu
  danger: "text-rose-600", // gagal / rugi / perlu dicek
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
    <div className="card p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 break-words text-3xl font-bold leading-tight ${TONES[negative ? "danger" : tone]}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
