"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import ExportButtons from "@/components/ExportButtons";
import TanpaHppNote from "@/components/TanpaHppNote";
import { formatRupiah, formatNumber } from "@/lib/format";
import { formatRupiahOrDash, shownProfitHpp, shownProfitAgen, shownSelisih } from "@/lib/hppDisplay";
import { UANG_CAIR_LABEL, UANG_CAIR_PESANAN_LABEL, PROFIT_BASIS_NOTE, rincianUangCairSub } from "@/lib/uangCairPeriode";

type SortKey = "profitHpp" | "qty";

export default function LaporanProfitPage() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<any>({ rows: [], summary: {} });
  const [sortKey, setSortKey] = useState<SortKey>("profitHpp");

  useEffect(() => {
    fetch(`/api/reports/profit?${qs}`).then((r) => r.json()).then(setData);
  }, [qs]);

  const rows: any[] = data.rows ?? [];
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sortKey === "profitHpp" ? b.profitHpp - a.profitHpp : b.qty - a.qty)),
    [rows, sortKey]
  );
  // T-013 temuan QA 2: total yang HPP-nya seluruhnya tidak diketahui tampil "-" (bukan "Rp 0").
  const s = data.summary ?? {};
  const total = {
    profitHpp: s.totalProfitHpp ?? 0,
    uangCair: s.totalUangCair ?? 0,
    tanpaHpp: s.tanpaHpp,
    profitAgen: s.totalProfitAgen ?? 0,
    selisih: s.selisih ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Profit & Barang Keluar</h1>
        <ExportButtons report="profit" />
      </div>

      <p className="inline-block rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-800">
        <strong>Dasar tanggal: tanggal pesanan dibuat.</strong> Bulan cut-off (26–25) dihitung dari tanggal pesanan dibuat,
        dalam WIB. Laporan Rekapan memakai dasar yang sama (tanggal pesanan, cut-off 26–25, WIB).
      </p>

      <p className="text-xs text-gray-500">
        Unit Keluar/Omzet Pesanan/Kontribusi Omzet dihitung dari pesanan <strong>berstatus Selesai</strong>. Uang Cair &amp;
        Profit HPP (Nett) pakai nilai <strong>AKTUAL dari Income Report yang sudah di-match</strong> (bukan estimasi nilai
        pesanan) — pesanan Selesai yang belum ketemu match-nya (lihat tab Uang Cair) belum ikut dihitung
        di sini. Profit Agen = (Harga Katalog × 50%) − HPP, direalisasi juga saat Belum Cair, independen dari uang cair
        aktual. Selisih menunjukkan potensi gap antara harga jual ke agen dan penerimaan riil dari Shopee.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Total Unit Keluar" value={formatNumber(data.summary?.totalQty ?? 0)} />
        <SummaryCard label="Jumlah SKU Terjual" value={formatNumber(data.summary?.skuCount ?? 0)} />
        {/* T-013 batch 13 (tugas X): semua saldo masuk periode ini + rincian (a)/(b)/(c). */}
        <SummaryCard
          tone="success"
          label={UANG_CAIR_LABEL}
          value={formatRupiah(data.summary?.uangCairPeriode?.total ?? 0)}
          sub={rincianUangCairSub(data.summary?.uangCairPeriode)}
        />
        <SummaryCard
          label="Total Profit HPP (Nett)"
          value={formatRupiahOrDash(shownProfitHpp(total))}
          negative={(data.summary?.totalProfitHpp ?? 0) < 0}
        />
        <SummaryCard
          label="Total Profit Agen"
          value={formatRupiahOrDash(shownProfitAgen(total))}
          negative={(data.summary?.totalProfitAgen ?? 0) < 0}
        />
        <SummaryCard
          label="Selisih Agen vs Riil"
          value={formatRupiahOrDash(shownSelisih(total))}
          negative={(data.summary?.selisih ?? 0) < 0}
        />
      </div>
      <p className="text-xs text-gray-500">
        {PROFIT_BASIS_NOTE} {UANG_CAIR_PESANAN_LABEL}:{" "}
        {formatRupiah(data.summary?.totalUangCair ?? 0)}.
      </p>
      <TanpaHppNote tanpaHpp={data.summary?.tanpaHpp} />

      <div className="flex gap-2">
        <button
          onClick={() => setSortKey("profitHpp")}
          className={`tab-pill ${sortKey === "profitHpp" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Urutkan: Profit HPP
        </button>
        <button
          onClick={() => setSortKey("qty")}
          className={`tab-pill ${sortKey === "qty" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Urutkan: Unit Terjual
        </button>
      </div>

      <DataTable
        rowKey={(r: any) => `${r.sku}|${r.name}`}
        rows={sorted}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => <span className="cell-wrap">{r.name}</span> },
          { header: "Unit Keluar", render: (r) => formatNumber(r.qty) },
          { header: "Kontribusi Omzet", render: (r) => `${((r.share ?? 0) * 100).toFixed(1)}%` },
          { header: "Omzet Pesanan", render: (r) => formatRupiah(r.omzet) },
          { header: UANG_CAIR_PESANAN_LABEL, render: (r) => formatRupiah(r.uangCair) },
          // T-013 temuan QA 2: produk yang HPP-nya seluruhnya tidak diketahui -> "-" (bukan "Rp 0").
          { header: "Profit HPP", render: (r) => formatRupiahOrDash(shownProfitHpp(r)) },
          { header: "Profit Agen", render: (r) => formatRupiahOrDash(shownProfitAgen(r)) },
          {
            header: "Selisih",
            render: (r) => {
              const v = shownSelisih(r);
              if (typeof v === "string") return <span className="text-gray-400">{v}</span>;
              return <span className={v >= 0 ? "text-success-text" : "text-red-600"}>{formatRupiah(v)}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
