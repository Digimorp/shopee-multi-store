"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import StageBadge, { ReconBadge, SettleBadge } from "@/components/StageBadge";
import { formatRupiah, formatDate, formatNumber } from "@/lib/format";
import { allocateLines, diffReconItems } from "@/lib/settlement";
import Toast, { type ToastMessage } from "@/components/Toast";
import SettlementDetailModal from "@/components/SettlementDetailModal";
import { Icon } from "@/components/icons";

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
  const [syncing, setSyncing] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0); // dinaikkan saat Sync ulang -> tabel cashflow ikut dimuat ulang
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [detailSn, setDetailSn] = useState<string | null>(null); // No. Pesanan yang popup Settlement Details-nya terbuka
  const closeDetail = useCallback(() => setDetailSn(null), []);

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
    fetch(`/api/reports/cashflow?${qs}&tab=${tab}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setCashflow)
      .finally(() => setCashflowLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, tab, syncNonce]);

  // "Sync ulang" = jalankan ulang matching Order vs Income Report dari data yang SUDAH ada
  // di DB (reconcile() dihitung tiap request, tidak ada status tersimpan). Tidak menarik
  // data dari Shopee. Hasil dibandingkan dengan yang sedang tampil -> jumlah order berubah.
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/reconciliation?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = await res.json();
      const d = diffReconItems(recon?.items ?? [], next.items ?? []);
      setRecon(next);
      setSyncNonce((n) => n + 1);
      const parts = [`${formatNumber(d.changed)} order berubah status`];
      if (d.added) parts.push(`${formatNumber(d.added)} order baru`);
      if (d.removed) parts.push(`${formatNumber(d.removed)} order hilang`);
      setToast({
        title: d.changed + d.added + d.removed > 0 ? "Sync selesai — ada perubahan" : "Sync selesai — tidak ada perubahan",
        detail: `${parts.join(", ")} dari ${formatNumber(d.total)} order dicek ulang.`,
      });
    } catch {
      setToast({ tone: "error", title: "Sync gagal", detail: "Tidak bisa menghitung ulang rekonsiliasi. Coba lagi." });
    } finally {
      setSyncing(false);
    }
  }

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

  // Tab cashflow = 1 baris per SKU, tapi payout Shopee per No. Pesanan. Aktual per baris =
  // alokasi proporsional payout order, supaya order multi-SKU tidak terhitung dobel.
  const cashflowRows: any[] = cashflow.orders ?? [];
  const lineAlloc = useMemo(() => allocateLines(cashflowRows, reconMap), [cashflowRows, reconMap]);
  const lineAktual = useMemo(
    () => new Map(cashflowRows.map((r, i) => [r.id, lineAlloc.perLine[i]] as const)),
    [cashflowRows, lineAlloc]
  );
  const aktualTotal = lineAlloc.total;
  const nMatched = lineAlloc.matchedOrders;
  const multiLineOrders = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of cashflowRows) n.set(r.orderSn, (n.get(r.orderSn) ?? 0) + 1);
    return n;
  }, [cashflowRows]);

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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || reconLoading}
            title="Hitung ulang matching Order vs Income Report dari data yang sudah di-upload"
            className="btn-ghost disabled:opacity-50"
          >
            <Icon name="refresh" size={16} strokeWidth={2} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Menghitung ulang…" : "Sync ulang"}
          </button>
          {isCashflowTab && <ExportButtons report="cashflow" params={{ tab }} />}
        </div>
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
        <SummaryCard icon="hourglass" label="Total Estimasi (Pesanan)" value={formatRupiah(totals.estimasi)} />
        <SummaryCard icon="coins" label="Total Aktual (Income Report)" value={formatRupiah(totals.aktual)} />
        <SummaryCard
          icon="trendingUp"
          label="Selisih Aktual − Estimasi"
          value={formatRupiah(totals.selisih)}
          negative={totals.selisih < 0}
        />
        <SummaryCard icon="sparkles" label="Adjustment Shopee" value={formatRupiah(totals.adjustment)} />
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
              <SummaryCard icon="clipboard" label="Jumlah Transaksi" value={String(cashflow.summary?.count ?? 0)} />
              <SummaryCard icon="cash" label="Total Omzet Bruto" value={formatRupiah(cashflow.summary?.totalGross ?? 0)} />
              <SummaryCard icon="hourglass" label="Total Nilai — ESTIMASI" value={formatRupiah(cashflow.summary?.totalNet ?? 0)} />
              <SummaryCard
                icon="coins"
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
                    return (
                      <button
                        onClick={() => setDetailSn(r.orderSn)}
                        disabled={!rc}
                        title="Lihat Settlement Details"
                        className={`underline decoration-dotted underline-offset-2 hover:text-brand-600 disabled:no-underline ${
                          stuck ? "font-semibold text-amber-700" : ""
                        }`}
                      >
                        {r.orderSn}
                      </button>
                    );
                  },
                },
                { header: "SKU", render: (r) => r.sku },
                { header: "Produk", render: (r) => <span className="block max-w-[160px] truncate">{r.productName}</span> },
                { header: "Qty", render: (r) => r.qty },
                { header: "Estimasi", render: (r) => formatRupiah(r.netSettlement) },
                {
                  header: "Aktual",
                  render: (r) => {
                    const a = lineAktual.get(r.id);
                    if (a == null) return <span className="text-gray-300">— belum</span>;
                    const order = reconMap.get(r.orderSn);
                    // Order multi-SKU: tampilkan porsi baris ini + payout order utuh sebagai konteks.
                    return (multiLineOrders.get(r.orderSn) ?? 1) > 1 ? (
                      <span title={`Alokasi proporsional dari payout order ${formatRupiah(order?.aktual ?? 0)}`}>
                        {formatRupiah(a)}
                        <span className="block text-[10px] text-gray-400">dari {formatRupiah(order?.aktual ?? 0)}</span>
                      </span>
                    ) : (
                      formatRupiah(a)
                    );
                  },
                },
                {
                  header: "Status Cair",
                  render: (r) => {
                    const rc = reconMap.get(r.orderSn);
                    return rc ? <SettleBadge status={rc.settleStatus} /> : <span className="text-gray-300">—</span>;
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
              {
                header: "No. Pesanan",
                render: (r) =>
                  r.side === "income" ? (
                    <span className="font-medium">{r.orderSn}</span> // order tidak ada di DB -> tak ada baris SKU
                  ) : (
                    <button
                      onClick={() => setDetailSn(r.orderSn)}
                      title="Lihat Settlement Details"
                      className="font-medium underline decoration-dotted underline-offset-2 hover:text-brand-600"
                    >
                      {r.orderSn}
                    </button>
                  ),
              },
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
              { header: "Status Cair", render: (r) => <SettleBadge status={r.settleStatus} /> },
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

      {detailSn && reconMap.get(detailSn) && (
        <SettlementDetailModal order={reconMap.get(detailSn)} qs={qs} onClose={closeDetail} />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
