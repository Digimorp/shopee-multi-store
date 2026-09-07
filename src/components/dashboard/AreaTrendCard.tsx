"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseISO, startOfWeek, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Icon, type IconName } from "@/components/icons";
import { formatRupiah } from "@/lib/format";
import type { TrendPoint } from "@/components/TrendChart";

type Bucket = "daily" | "weekly" | "monthly" | "yearly";
const TABS: { key: Bucket; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "yearly", label: "Tahunan" },
];

function bucketKey(dateStr: string, b: Bucket): string {
  if (b === "yearly") return dateStr.slice(0, 4);
  if (b === "monthly") return dateStr.slice(0, 7);
  if (b === "weekly") return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), "yyyy-MM-dd");
  return dateStr;
}

function axisLabel(key: string, b: Bucket): string {
  if (b === "yearly") return key;
  if (b === "monthly") return format(parseISO(key + "-01"), "MMM yy", { locale: idLocale });
  return format(parseISO(key), "d MMM", { locale: idLocale });
}

const MINI: { key: string; label: string; icon: IconName; tint: string }[] = [
  { key: "totalOmzetBruto", label: "Omzet Bruto", icon: "cash", tint: "bg-brand-100 text-brand-600" },
  { key: "uangCair", label: "Uang Cair", icon: "coins", tint: "bg-emerald-100 text-emerald-600" },
  { key: "uangMengambang", label: "Mengambang", icon: "hourglass", tint: "bg-purple-100 text-purple-600" },
  { key: "profitHpp", label: "Profit HPP", icon: "trendingUp", tint: "bg-blue-100 text-blue-600" },
  { key: "profitAgen", label: "Profit Agen", icon: "sparkles", tint: "bg-orange-100 text-orange-600" },
];

export default function AreaTrendCard({
  trend,
  summary,
  loading,
  periodLabel,
}: {
  trend: TrendPoint[];
  summary: any;
  loading: boolean;
  periodLabel: string;
}) {
  const [bucket, setBucket] = useState<Bucket>("daily");

  const data = useMemo(() => {
    const map = new Map<string, { label: string; omzet: number; profit: number }>();
    for (const p of trend) {
      const k = bucketKey(p.date, bucket);
      const cur = map.get(k) ?? { label: k, omzet: 0, profit: 0 };
      cur.omzet += p.omzet;
      cur.profit += p.profit;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => (a.label < b.label ? -1 : 1));
  }, [trend, bucket]);

  const totalOmzet = summary?.totalOmzetBruto ?? 0;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400">Total Omzet Bruto</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{formatRupiah(totalOmzet)}</p>
          <p className="mt-0.5 text-xs text-gray-400">Periode {periodLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 rounded-full bg-gray-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setBucket(t.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  bucket === t.key ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn-primary px-3 py-1.5 text-xs">
            <Icon name="arrowRight" size={14} />
            Lihat Ringkasan
          </button>
        </div>
      </div>

      <div className="mt-4 h-[240px]">
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-gray-400">Memuat…</div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-gray-400">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f1f4" vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={(v) => axisLabel(v, bucket)}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                width={38}
              />
              <Tooltip
                formatter={(v: number) => formatRupiah(v)}
                contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}
              />
              <Area isAnimationActive={false} type="monotone" dataKey="omzet" name="Omzet" stroke="#ec4899" strokeWidth={2.5} fill="url(#gOmzet)" />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" name="Profit HPP" stroke="#a855f7" strokeWidth={2.5} fill="url(#gProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-gray-100 pt-4 sm:grid-cols-3 lg:grid-cols-5">
        {MINI.map((m) => (
          <div key={m.key} className="flex items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.tint}`}>
              <Icon name={m.icon} size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold tabular-nums text-gray-900">{formatRupiah(summary?.[m.key] ?? 0)}</p>
              <p className="text-[11px] text-gray-400">{m.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
