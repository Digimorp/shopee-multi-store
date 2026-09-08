"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatRupiah } from "@/lib/format";

const COLORS = ["#ec4899", "#a855f7", "#3b82f6", "#f97316", "#10b981", "#f59e0b", "#94a3b8"];

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
    <div className="card p-5">
      <p className="text-sm font-semibold text-gray-800">Distribusi Omzet per Toko</p>
      <p className="text-xs text-gray-400">Berdasarkan periode & filter aktif</p>

      {loading ? (
        <div className="grid h-[220px] place-items-center text-sm text-gray-400">Memuat…</div>
      ) : error && slices.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-amber-600">Gagal memuat data.</div>
      ) : slices.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-gray-400">Belum ada omzet pada periode ini.</div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <PieChart>
                <Pie isAnimationActive={false} data={slices} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {slices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Total</p>
                <p className="text-sm font-bold text-gray-900">{formatRupiah(total)}</p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {slices.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {s.name}
                </span>
                <span className="font-semibold text-gray-800">
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
