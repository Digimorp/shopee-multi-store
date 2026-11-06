import { Icon, type IconName } from "@/components/icons";

// Chip ikon stat — SATU gaya untuk semua metrik & halaman: flat, 1 warna aksen hijau brand.
// Dipakai juga oleh header LeaderboardToko supaya tidak ada varian ikon lain.
// `alert` = pengecualian khusus penanda "perlu dicek manual" (merah, selalu — bukan tren nilai).
export function StatIcon({ icon, alert = false }: { icon: IconName; alert?: boolean }) {
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
        alert ? "bg-rose-100 text-rose-600" : "bg-brand-100 text-brand-600"
      }`}
    >
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

// Stat card baku: card putih flat, border tipis 1px abu, shadow minimal. Angka besar tetap gelap.
export default function SummaryCard({
  label,
  value,
  icon = "sparkles",
  sub,
  negative = false,
  alert = false,
}: {
  label: string;
  value: string;
  icon?: IconName;
  sub?: string;
  /** true = angka ditampilkan merah (mis. selisih negatif). Ikon tetap hijau brand. */
  negative?: boolean;
  /** true = ikon merah SELALU, penanda "perlu dicek manual" (mis. Selisih di Dashboard). */
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <StatIcon icon={icon} alert={alert} />
        <div className="min-w-0">
          <p className={`truncate text-lg font-bold leading-tight ${negative ? "text-rose-600" : "text-gray-900"}`}>{value}</p>
          <p className="truncate text-xs font-medium text-gray-400">{label}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
