import { Icon, type IconName } from "@/components/icons";

type Accent = "brand" | "green" | "purple" | "blue" | "red" | "orange";
type Gradient = "pink" | "purple" | "blue" | "orange";

// Badge ikon: gradient bulat per kategori, ikon putih — selaras dengan kartu gradient dashboard.
const TINT: Record<Accent, string> = {
  brand: "from-brand-500 to-grape-500",
  green: "from-emerald-500 to-teal-500",
  purple: "from-grape-500 to-fuchsia-500",
  blue: "from-blue-500 to-indigo-500",
  red: "from-rose-500 to-red-500",
  orange: "from-orange-500 to-amber-500",
};

const GRAD: Record<Gradient, string> = {
  pink: "bg-stat-pink",
  purple: "bg-stat-purple",
  blue: "bg-stat-blue",
  orange: "bg-stat-orange",
};

export default function SummaryCard({
  label,
  value,
  accent = "brand",
  gradient,
  icon = "sparkles",
  sub,
}: {
  label: string;
  value: string;
  accent?: Accent;
  gradient?: Gradient;
  icon?: IconName;
  sub?: string;
}) {
  if (gradient) {
    return (
      <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-card ${GRAD[gradient]}`}>
        <div className="absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/15" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/25">
            <Icon name={icon} size={20} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-tight">{value}</p>
            <p className="truncate text-xs font-medium text-white/85">{label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
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
