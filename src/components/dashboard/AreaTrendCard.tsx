"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseISO, startOfWeek, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Icon } from "@/components/icons";
import SlidingTabs from "@/components/SlidingTabs";
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

export default function AreaTrendCard({
  trend,
  summary,
  loading,
  error = false,
  periodLabel,
}: {
  trend: TrendPoint[];
  summary: any;
  loading: boolean;
  error?: boolean;
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
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Total Omzet Bruto</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-950">{formatRupiah(totalOmzet)}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Periode {periodLabel}</p>
        </div>
        <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
          <SlidingTabs
            ariaLabel="Satuan waktu grafik"
            size="sm"
            stretch
            className="w-full sm:w-auto"
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
            activeKey={bucket}
            onSelect={(k) => setBucket(k as Bucket)}
          />
          <button className="btn-primary px-3 py-1.5 text-xs">
            <Icon name="arrowRight" size={14} />
            Lihat Ringkasan
          </button>
        </div>
      </div>

      {/* Legenda: dua seri sama-sama netral, jadi perlu label eksplisit (hitam = omzet, abu = profit). */}
      <div className="mt-5 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-950" />
          Omzet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-400" />
          Profit HPP
        </span>
      </div>

      <div className="mt-3 h-[240px]">
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-neutral-400">Memuat…</div>
        ) : error && data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-amber-600">Gagal memuat data grafik.</div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-neutral-400">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a3a3a3" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#efefef" vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={(v) => axisLabel(v, bucket)}
                tick={{ fontSize: 10, fill: "#a3a3a3" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a3a3a3" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                width={38}
              />
              <Tooltip
                formatter={(v: number) => formatRupiah(v)}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12, boxShadow: "none" }}
              />
              <Area isAnimationActive={false} type="monotone" dataKey="omzet" name="Omzet" stroke="#0a0a0a" strokeWidth={2} fill="url(#gOmzet)" />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" name="Profit HPP" stroke="#a3a3a3" strokeWidth={2} fill="url(#gProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
