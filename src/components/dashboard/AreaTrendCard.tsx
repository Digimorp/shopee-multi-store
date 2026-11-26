"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseISO, startOfWeek, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import ChartTooltip from "@/components/dashboard/ChartTooltip";
import { formatAxisShort, formatRupiah } from "@/lib/format";
import type { TrendPoint } from "@/components/TrendChart";

export type Bucket = "daily" | "weekly" | "monthly" | "yearly";
/** Pilihan satuan waktu grafik -- dipakai segmented control di baris kontrol Dashboard. */
export const BUCKET_TABS: { key: Bucket; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "yearly", label: "Tahunan" },
];

const AXIS = { fontSize: 13, fill: "#667180" };
const TEAL = "#17A398";
const VIOLET = "#8B7CF6";

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

/**
 * T-013 batch 18 (Kaca Lembut): kartu grafik Omzet Pesanan. Garis teal tebal + area gradasi lembut
 * (Omzet), garis ungu putus-putus (Profit HPP), sumbu #667180, tooltip gelap. Data & agregasi sama
 * dengan sebelumnya; satuan waktu dipilih di segmented control halaman (prop `bucket`).
 */
export default function AreaTrendCard({
  trend,
  summary,
  loading,
  error = false,
  periodLabel,
  bucket,
}: {
  trend: TrendPoint[];
  summary: any;
  loading: boolean;
  error?: boolean;
  periodLabel: string;
  bucket: Bucket;
}) {
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
    <div className="card p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink">Omzet Pesanan</h2>
      <p className="text-xs text-muted">Periode {periodLabel}</p>
      <p className="num mt-2 break-words text-[32px] font-bold leading-tight text-ink">
        {summary ? formatRupiah(totalOmzet) : "-" /* T-013 temuan QA 8: tanpa data -> "-", bukan "Rp 0" */}
      </p>

      <div className="mt-3 h-[240px]">
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-muted">Memuat…</div>
        ) : error && data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-amber-700">Gagal memuat data grafik.</div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted">Belum ada data pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="#667180" strokeOpacity={0.25} vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={(v) => axisLabel(v, bucket)}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatAxisShort(v)} width={46} />
              <Tooltip
                content={<ChartTooltip labelFormatter={(v) => axisLabel(String(v), bucket)} />}
                cursor={{ stroke: "#10141A", strokeOpacity: 0.35 }}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="omzet"
                name="Omzet"
                stroke={TEAL}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="url(#gOmzet)"
                activeDot={{ r: 5, fill: "#fff", stroke: TEAL, strokeWidth: 3 }}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="profit"
                name="Profit HPP"
                stroke={VIOLET}
                strokeWidth={2.5}
                strokeDasharray="6 5"
                fill="none"
                activeDot={{ r: 4, fill: "#fff", stroke: VIOLET, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legenda: dua seri, label eksplisit. */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
          Omzet
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-accent2" />
          Profit HPP
        </span>
      </div>
    </div>
  );
}
