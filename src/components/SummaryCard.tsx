import { Icon, type IconName } from "@/components/icons";

type Accent = "brand" | "green" | "purple" | "blue" | "red" | "orange";

// Badge ikon kecil per kategori — kartu tetap putih/soft, angka besar tetap gelap biar kebaca jelas.
const TINT: Record<Accent, string> = {
  brand: "from-brand-500 to-brand-600",
  green: "from-emerald-500 to-teal-500",
  purple: "from-grape-500 to-grape-600",
  blue: "from-blue-500 to-indigo-500",
  red: "from-rose-500 to-red-500",
  orange: "from-orange-500 to-amber-500",
};

export default function SummaryCard({
  label,
  value,
  accent = "brand",
  icon = "sparkles",
  sub,
}: {
  label: string;
  value: string;
  accent?: Accent;
  icon?: IconName;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${TINT[accent]}`}
        >
          <Icon name={icon} size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight text-gray-900">{value}</p>
          <p className="truncate text-xs font-medium text-gray-400">{label}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
