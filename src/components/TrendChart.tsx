"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatRupiah } from "@/lib/format";

export type TrendPoint = { date: string; omzet: number; profit: number };

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center text-sm text-gray-400">Belum ada data pada periode ini.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v: number) => formatRupiah(v)} />
        <Legend />
        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#ee4d2d" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="profit" name="Profit HPP" stroke="#16a34a" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
