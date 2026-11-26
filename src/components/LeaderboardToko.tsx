"use client";

import { RankBadge } from "@/components/SummaryCard";
import { formatRupiah } from "@/lib/format";
import { hasKnownHpp } from "@/lib/hppDisplay";

type Row = {
  toko: string;
  profitHpp: number;
  omzet: number;
  order: number;
  uangCair: number;
  tanpaHpp?: { baris: number; uangCair: number } | null;
};

function List({
  title,
  items,
  emptyText,
  dash = false,
}: {
  title: string;
  items: Row[];
  emptyText: string;
  /** tampilkan "-" besar di atas teks kosong (dipakai saat HPP belum ada sama sekali) */
  dash?: boolean;
}) {
  return (
    <div className="card p-6">
      <p className="mb-3 text-sm font-semibold text-ink">{title}</p>
      {items.length === 0 ? (
        <div className="py-4 text-center text-muted">
          {dash && <p className="text-lg font-bold">-</p>}
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {items.map((r, i) => (
            <li key={r.toko} className="flex items-center gap-3">
              <RankBadge rank={i + 1} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.toko}</span>
              <span
                className={`shrink-0 text-sm font-bold ${
                  r.profitHpp > 0 ? "text-success-text" : r.profitHpp < 0 ? "text-danger-text" : "text-muted"
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

/**
 * T-013 temuan QA 2: peringkat profit HANYA dari toko yang HPP-nya diketahui (minimal satu baris
 * cair ber-HPP). Toko yang profitnya tidak diketahui (semua baris tanpa HPP) tidak boleh terpilih
 * sebagai "Paling Untung" / "Perlu Perhatian" dengan angka Rp 0.
 */
export function leaderboardLists(rows: Row[]) {
  const active = (rows ?? []).filter((r) => (r.order ?? 0) > 0 || (r.omzet ?? 0) > 0);
  const known = active.filter((r) => hasKnownHpp(r));
  const byProfit = [...known].sort((a, b) => b.profitHpp - a.profitHpp);
  return {
    untung: byProfit.slice(0, 3),
    rugi: [...byProfit].reverse().slice(0, 3),
    /** ada toko bertransaksi, tapi tidak satu pun HPP-nya diketahui */
    belumAdaHpp: active.length > 0 && known.length === 0,
  };
}

export default function LeaderboardToko({ rows }: { rows: Row[] }) {
  const { untung, rugi, belumAdaHpp } = leaderboardLists(rows);
  const emptyText = belumAdaHpp ? "Belum ada data HPP" : "Belum ada toko dengan transaksi pada periode ini.";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <List
        title="Toko Paling Untung (Profit HPP)"
        items={untung}
        emptyText={emptyText}
        dash={belumAdaHpp}
      />
      <List
        title="Toko Perlu Perhatian (Profit terendah)"
        items={rugi}
        emptyText={emptyText}
        dash={belumAdaHpp}
      />
    </div>
  );
}
