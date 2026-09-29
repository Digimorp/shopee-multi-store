"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import StageBadge, { ReconBadge } from "@/components/StageBadge";
import { formatRupiah, formatDate, formatNumber } from "@/lib/format";

type TabKey = "cair" | "pending" | "transit" | "SELISIH" | "BELUM_KETEMU" | "ALL";

const CASHFLOW_TABS: { key: TabKey; label: string }[] = [
  { key: "cair", label: "Uang Cair (Selesai)" },
  { key: "pending", label: "Uang Mengambang (Pending)" },
  { key: "transit", label: "Barang di Jalan (Transit)" },
];
const RECON_TABS: { key: TabKey; label: string }[] = [
  { key: "SELISIH", label: "Selisih" },
  { key: "BELUM_KETEMU", label: "Belum Ketemu" },
  { key: "ALL", label: "Semua Order" },
];
const ALL_TABS = [...CASHFLOW_TABS, ...RECON_TABS];
const CASHFLOW_KEYS = new Set<TabKey>(CASHFLOW_TABS.map((t) => t.key));

export default function RekonsiliasiPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [tab, setTab] = useState<TabKey>("cair");

  const [recon, setRecon] = useState<any>(null);
  const [reconLoading, setReconLoading] = useState(true);
  const [cashflow, setCashflow] = useState<any>({ orders: [], summary: {} });
  const [cashflowLoading, setCashflowLoading] = useState(true);

  const isCashflowTab = CASHFLOW_KEYS.has(tab);

  useEffect(() => {
    setReconLoading(true);
    fetch(`/api/reconciliation?${qs}`)
      .then((r) => r.json())
      .then(setRecon)
      .catch(() => setRecon(null))
      .finally(() => setReconLoading(false));
  }, [qs]);

  useEffect(() => {
    if (!isCashflowTab) return;
    setCashflowLoading(true);
    fetch(`/api/reports/cashflow?${qs}&tab=${tab}`)
      .then((r) => r.json())
      .then(setCashflow)
      .finally(() => setCashflowLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, tab]);

  const rate = recon?.rate ?? { match: 0, selisih: 0, belumKetemu: 0, total: 0, matchPct: 0 };
  const totals = recon?.totals ?? { estimasi: 0, aktual: 0, selisih: 0, adjustment: 0 };
  const items: any[] = recon?.items ?? [];
  const adjustments: any[] = recon?.adjustments ?? [];
  const cfg = recon?.config ?? { toleransiRp: 5, finalLockDays: 14, stuckDays: 7, payoutRatio: 1 };
  const payoutRatio = cfg.payoutRatio ?? 1;

  // Map No. Pesanan -> hasil rekonsiliasi (dipakai kolom Aktual/Tahap di tab Cair/Pending/Transit)
  const reconMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const it of items) m.set(it.orderSn, it);
    return m;
  }, [items]);

  const cashflowRows: any[] = cashflow.orders ?? [];
  const aktualTotal = useMemo(
    () => cashflowRows.reduce((s, r) => s + (reconMap.get(r.orderSn)?.aktual ?? 0), 0),
    [cashflowRows, reconMap]
  );
  const nMatched = useMemo(
    () => cashflowRows.filter((r) => reconMap.get(r.orderSn)?.aktual != null).length,
    [cashflowRows, reconMap]
  );

  const problemRows = useMemo(() => {
    if (tab === "ALL") return items;
    if (tab === "SELISIH" || tab === "BELUM_KETEMU") return items.filter((i) => i.category === tab);
    return [];
  }, [items, tab]);

  const pct = (n: number) => (rate.total ? ((n / rate.total) * 100).toFixed(1) : "0.0");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Keuangan & Rekonsiliasi</h1>
          <p className="text-sm text-gray-400">
            Bandingkan <strong>estimasi</strong> (nilai kotor pesanan) vs <strong>aktual</strong> (Income Report Shopee),
            key = No. Pesanan. Status &quot;Cair Final&quot; terkunci setelah H+{cfg.finalLockDays}.
            {payoutRatio < 0.98 && (
              <>
                {" "}
                Rasio pencairan khas toko ini <strong>{Math.round(payoutRatio * 100)}%</strong> dari nilai kotor (sisanya
                potongan biaya Shopee) — <strong>CAIR</strong> = cair dalam rentang wajar rasio itu, <strong>SELISIH</strong>{" "}
                = meleset jauh (perlu dicek).
              </>
            )}
          </p>
        </div>
        {isCashflowTab && <ExportButtons report="cashflow" params={{ tab }} />}
      </div>

      {/* Reconciliation Rate */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">Reconciliation Rate</p>
          <p className="text-sm text-gray-500">
            {reconLoading ? "…" : `${(rate.matchPct * 100).toFixed(1)}% cair`} dari {formatNumber(rate.total)} order
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
            <p className="text-[11px] text-gray-400">CAIR ({pct(rate.match)}%)</p>
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

      {/* Tab gabungan: cashflow (Cair/Pending/Transit) + rekonsiliasi (Selisih/Belum Ketemu/Semua Order) */}
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {ALL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab-pill ${tab === t.key ? "tab-pill-active" : "tab-pill-idle"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isCashflowTab ? (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-4">
              <SummaryCard icon="clipboard" accent="blue" label="Jumlah Transaksi" value={String(cashflow.summary?.count ?? 0)} />
              <SummaryCard icon="cash" accent="brand" label="Total Omzet Bruto" value={formatRupiah(cashflow.summary?.totalGross ?? 0)} />
              <SummaryCard icon="hourglass" accent="purple" label="Total Nilai — ESTIMASI" value={formatRupiah(cashflow.summary?.totalNet ?? 0)} />
              <SummaryCard
                icon="coins"
                accent="green"
                label={`Total Nilai — AKTUAL (${nMatched} matched)`}
                value={formatRupiah(aktualTotal)}
              />
            </div>
            {tab === "cair" && (
              <p className="mb-3 text-xs text-gray-400">
                Kolom <strong>Estimasi</strong> = hitungan dari data Pesanan. <strong>Aktual</strong> = dari Income
                Report yang sudah di-match. Baris kuning = &quot;Sampai&quot; &gt; 7 hari belum cair, kemungkinan retur
                pending.
              </p>
            )}
            <DataTable
              rowKey={(r: any) => r.id}
              rows={cashflowRows}
              emptyText={cashflowLoading ? "Memuat…" : "Tidak ada order pada tab ini."}
              columns={[
                { header: "Tanggal", render: (r) => formatDate(r.orderCreatedAt) },
                { header: "Toko", render: (r) => r.store.code },
                {
                  header: "No. Pesanan",
                  render: (r) => {
                    const rc = reconMap.get(r.orderSn);
                    const stuck = rc?.flags?.includes("SAMPAI_7H_BELUM_CAIR");
                    return <span className={stuck ? "font-semibold text-amber-700" : ""}>{r.orderSn}</span>;
                  },
                },
                { header: "SKU", render: (r) => r.sku },
                { header: "Produk", render: (r) => <span className="block max-w-[160px] truncate">{r.productName}</span> },
                { header: "Qty", render: (r) => r.qty },
                { header: "Estimasi", render: (r) => formatRupiah(r.netSettlement) },
                {
                  header: "Aktual",
                  render: (r) => {
                    const a = reconMap.get(r.orderSn)?.aktual;
                    return a == null ? <span className="text-gray-300">— belum</span> : formatRupiah(a);
                  },
                },
                {
                  header: "Tahap",
                  render: (r) => {
                    const rc = reconMap.get(r.orderSn);
                    return rc ? <StageBadge stage={rc.stage} /> : <span className="text-gray-300">—</span>;
                  },
                },
              ]}
            />
          </>
        ) : (
          <DataTable
            rowKey={(r: any, i) => r.orderSn + i}
            rows={problemRows}
            emptyText={reconLoading ? "Memuat…" : "Tidak ada order pada kategori ini."}
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
        )}
      </div>

      {/* Adjustment Shopee (non-order) — selalu tampil terlepas dari tab yang aktif */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-gray-800">Adjustment Shopee (non-order)</h2>
        <p className="mb-2 text-xs text-gray-400">
          Kompensasi / sengketa / reimbursement promo — tidak dipaksa match ke No. Pesanan.
        </p>
        <DataTable
          rowKey={(r: any, i) => r.kind + i}
          rows={adjustments}
          emptyText={reconLoading ? "Memuat…" : "Tidak ada adjustment pada Income Report aktif."}
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
