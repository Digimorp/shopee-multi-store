"use client";

import { Icon } from "@/components/icons";
import { formatRupiah } from "@/lib/format";

type Row = { toko: string; profitHpp: number; omzet: number; order: number };

const RANK_TINT = ["bg-amber-100 text-amber-700", "bg-gray-100 text-gray-600", "bg-orange-100 text-orange-700"];

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
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-100 text-brand-600">
          <Icon name={icon} size={15} />
        </span>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((r, i) => (
            <li key={r.toko} className="flex items-center gap-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  RANK_TINT[i] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{r.toko}</span>
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
