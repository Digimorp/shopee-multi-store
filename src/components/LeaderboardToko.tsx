"use client";

import { RankBadge, StatIcon } from "@/components/SummaryCard";
import { formatRupiah } from "@/lib/format";

type Row = { toko: string; profitHpp: number; omzet: number; order: number };

function List({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: "trendingUp" | "undo";
  items: Row[];
  emptyText: string;
}) {
  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center gap-3">
        <StatIcon icon={icon} />
        <p className="text-sm font-semibold text-gray-800">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((r, i) => (
            <li key={r.toko} className="flex items-center gap-3">
              <RankBadge rank={i + 1} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{r.toko}</span>
              <span
                className={`shrink-0 text-sm font-bold ${
                  r.profitHpp > 0 ? "text-emerald-600" : r.profitHpp < 0 ? "text-rose-600" : "text-gray-400"
                }`}
              >
                {formatRupiah(r.profitHpp)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function LeaderboardToko({ rows }: { rows: Row[] }) {
  const active = (rows ?? []).filter((r) => (r.order ?? 0) > 0 || (r.omzet ?? 0) > 0);
  const byProfit = [...active].sort((a, b) => b.profitHpp - a.profitHpp);
  const untung = byProfit.slice(0, 3);
  const rugi = [...byProfit].reverse().slice(0, 3);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <List
        title="Toko Paling Untung (Profit HPP)"
        icon="trendingUp"
        items={untung}
        emptyText="Belum ada toko dengan transaksi pada periode ini."
      />
      <List
        title="Toko Perlu Perhatian (Profit terendah)"
        icon="undo"
        items={rugi}
        emptyText="Belum ada toko dengan transaksi pada periode ini."
      />
    </div>
  );
}
