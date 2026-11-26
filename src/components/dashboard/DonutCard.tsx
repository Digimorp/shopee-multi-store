"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ChartTooltip from "@/components/dashboard/ChartTooltip";
import { formatRupiah } from "@/lib/format";

// T-013 batch 18 (Kaca Lembut): palet teal/ungu menurut peringkat omzet toko (terbesar = teal),
// dipisah celah paddingAngle; "Lainnya" abu muda. Nama + persen tetap ditulis di legenda (warna bukan satu-satunya penanda).
const RAMP = ["#17A398", "#8B7CF6", "#0B6F67", "#B9E5E0", "#C9C1FB", "#667180"];
const OTHERS_COLOR = "#DDE2E8";
const sliceColor = (name: string, i: number) => (name === "Lainnya" ? OTHERS_COLOR : RAMP[i % RAMP.length]);

export default function DonutCard({
  rows,
  loading,
  error = false,
}: {
  rows: any[];
  loading: boolean;
  error?: boolean;
}) {
  const { slices, total } = useMemo(() => {
    const sorted = [...(rows ?? [])]
      .filter((r) => (r.omzet ?? 0) > 0)
      .sort((a, b) => b.omzet - a.omzet);
    const top = sorted.slice(0, 6);
    const restVal = sorted.slice(6).reduce((s, r) => s + r.omzet, 0);
    const list = top.map((r) => ({ name: (r.toko ?? "").split(" - ")[0] || r.toko, value: r.omzet }));
    if (restVal > 0) list.push({ name: "Lainnya", value: restVal });
    const t = list.reduce((s, r) => s + r.value, 0);
    return { slices: list, total: t };
  }, [rows]);

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink">Distribusi Omzet per Toko</h2>
      <p className="text-xs text-muted">Berdasarkan periode & filter aktif</p>

      {loading ? (
        <div className="grid h-[220px] place-items-center text-sm text-muted">Memuat…</div>
      ) : error && slices.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-amber-700">Gagal memuat data.</div>
      ) : slices.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-muted">Belum ada omzet pada periode ini.</div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <PieChart>
                <Pie isAnimationActive={false} data={slices} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {slices.map((s, i) => (
                    <Cell key={i} fill={sliceColor(s.name, i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-xs text-muted">Total</p>
                <p className="num text-sm font-bold text-ink">{formatRupiah(total)}</p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {slices.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: sliceColor(s.name, i) }} />
                  <span className="break-words">{s.name}</span>
                </span>
                <span className="num shrink-0 font-semibold text-ink">
                  {total ? ((s.value / total) * 100).toFixed(1) : "0.0"}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
