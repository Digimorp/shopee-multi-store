"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import StageBadge, { ReconBadge } from "@/components/StageBadge";
import { formatRupiah, formatDate, formatNumber } from "@/lib/format";

export default function RekonsiliasiPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"SELISIH" | "BELUM_KETEMU" | "ALL">("SELISIH");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reconciliation?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [qs]);

  const rate = data?.rate ?? { match: 0, selisih: 0, belumKetemu: 0, total: 0, matchPct: 0 };
  const totals = data?.totals ?? { estimasi: 0, aktual: 0, selisih: 0, adjustment: 0 };
  const items: any[] = data?.items ?? [];
  const adjustments: any[] = data?.adjustments ?? [];
  const cfg = data?.config ?? { toleransiRp: 5, finalLockDays: 14, stuckDays: 7, payoutRatio: 1 };
  const payoutRatio = cfg.payoutRatio ?? 1;

  const problem = useMemo(() => {
    if (tab === "ALL") return items;
    return items.filter((i) => i.category === tab);
  }, [items, tab]);

  const pct = (n: number) => (rate.total ? ((n / rate.total) * 100).toFixed(1) : "0.0");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rekonsiliasi Uang Cair</h1>
        <p className="text-sm text-gray-400">
          Bandingkan <strong>estimasi</strong> (nilai kotor pesanan) vs <strong>aktual</strong> (Income Report Shopee),
          key = No. Pesanan. Status &quot;Cair Final&quot; terkunci setelah H+{cfg.finalLockDays}.
          {payoutRatio < 0.98 && (
            <>
              {" "}
              Rasio pencairan khas toko ini <strong>{Math.round(payoutRatio * 100)}%</strong> dari nilai kotor (sisanya
              potongan biaya Shopee) — <strong>MATCH</strong> = cair dalam rentang wajar rasio itu, <strong>SELISIH</strong>{" "}
              = meleset jauh (perlu dicek).
            </>
          )}
        </p>
      </div>

      {/* Reconciliation Rate */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">Reconciliation Rate</p>
          <p className="text-sm text-gray-500">
            {loading ? "…" : `${(rate.matchPct * 100).toFixed(1)}% match`} dari {formatNumber(rate.total)} order
          </p>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="bg-emerald-500" style={{ width: `${pct(rate.match)}%` }} />
          <div className="bg-amber-500" style={{ width: `${pct(rate.selisih)}%` }} />
          <div className="bg-rose-500" style={{ width: `${pct(rate.belumKetemu)}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-emerald-600">{formatNumber(rate.match)}</p>
            <p className="text-[11px] text-gray-400">MATCH ({pct(rate.match)}%)</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-600">{formatNumber(rate.selisih)}</p>
            <p className="text-[11px] text-gray-400">SELISIH ({pct(rate.selisih)}%)</p>
          </div>
          <div>
            <p className="text-lg font-bold text-rose-600">{formatNumber(rate.belumKetemu)}</p>
            <p className="text-[11px] text-gray-400">BELUM KETEMU ({pct(rate.belumKetemu)}%)</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon="hourglass" accent="brand" label="Total Estimasi (Pesanan)" value={formatRupiah(totals.estimasi)} />
        <SummaryCard icon="coins" accent="green" label="Total Aktual (Income Report)" value={formatRupiah(totals.aktual)} />
        <SummaryCard
          icon="trendingUp"
          accent={totals.selisih < 0 ? "red" : "green"}
          label="Selisih Aktual − Estimasi"
          value={formatRupiah(totals.selisih)}
        />
        <SummaryCard icon="sparkles" accent="purple" label="Adjustment Shopee" value={formatRupiah(totals.adjustment)} />
      </div>

      {/* Daftar SELISIH / BELUM KETEMU */}
      <div>
        <div className="mb-3 flex gap-2">
          {(["SELISIH", "BELUM_KETEMU", "ALL"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab-pill ${tab === t ? "tab-pill-active" : "tab-pill-idle"}`}
            >
              {t === "ALL" ? "Semua Order" : t === "BELUM_KETEMU" ? "Belum Ketemu" : "Selisih"}
            </button>
          ))}
        </div>
        <DataTable
          rowKey={(r: any, i) => r.orderSn + i}
          rows={problem}
          emptyText={loading ? "Memuat…" : "Tidak ada order pada kategori ini."}
          columns={[
            { header: "No. Pesanan", render: (r) => <span className="font-medium">{r.orderSn}</span> },
            { header: "Toko", render: (r) => r.storeCode },
            { header: "Produk", render: (r) => <span className="block max-w-[180px] truncate">{r.productName}</span> },
            { header: "Estimasi", render: (r) => formatRupiah(r.estimasi) },
            { header: "Aktual", render: (r) => (r.aktual == null ? <span className="text-gray-300">—</span> : formatRupiah(r.aktual)) },
            {
              header: "Selisih",
              render: (r) =>
                r.selisih == null ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  <span className={r.selisih < 0 ? "text-rose-600" : r.selisih > 0 ? "text-emerald-600" : "text-gray-500"}>
                    {formatRupiah(r.selisih)}
                  </span>
                ),
            },
            { header: "Kategori", render: (r) => <ReconBadge category={r.category} /> },
            { header: "Tahap", render: (r) => <StageBadge stage={r.stage} /> },
            {
              header: "Catatan",
              render: (r) =>
                r.flags?.length ? (
                  <span className="text-[11px] text-amber-700">{r.flags.join(", ")}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                ),
            },
          ]}
        />
      </div>

      {/* Adjustment Shopee */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-gray-800">Adjustment Shopee (non-order)</h2>
        <p className="mb-2 text-xs text-gray-400">
          Kompensasi / sengketa / reimbursement promo — tidak dipaksa match ke No. Pesanan.
        </p>
        <DataTable
          rowKey={(r: any, i) => r.kind + i}
          rows={adjustments}
          emptyText={loading ? "Memuat…" : "Tidak ada adjustment pada Income Report aktif."}
          columns={[
            { header: "Tanggal", render: (r) => (r.releasedAt ? formatDate(r.releasedAt) : "—") },
            { header: "Jenis", render: (r) => r.kind },
            { header: "Deskripsi", render: (r) => r.description ?? "—" },
            {
              header: "Jumlah",
              render: (r) => (
                <span className={r.amount < 0 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(r.amount)}</span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
