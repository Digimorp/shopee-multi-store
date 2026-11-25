"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import SummaryCard from "@/components/SummaryCard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import {
  AGE_BUCKETS,
  ON_PROSES_GROUPS,
  ON_PROSES_GROUP_LABEL,
  type OnProsesResult,
  type OnProsesRow,
} from "@/lib/onProses";

// T-013 batch 15 (D) + 16 (B): On Proses -- uang belum masuk, dari SEMUA periode, hanya filter Toko.
// Kelompok: "Dalam pengiriman" (Transit) dan "Selesai, belum cair" (definisi Rekonsiliasi).
const STATUS_LABEL: Record<string, string> = ON_PROSES_GROUP_LABEL;
const BUCKET_LABEL: Record<string, string> = { "0-3": "0-3 hari", "4-7": "4-7 hari", ">7": "> 7 hari" };
type Pick = { group: string; bucket: string } | null;

export default function OnProsesPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "all";
  const [data, setData] = useState<OnProsesResult | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick>(null);

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(`/api/on-proses?storeId=${encodeURIComponent(storeId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [storeId]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (!pick || (r.group === pick.group && r.bucket === pick.bucket)) &&
        (!term || r.orderSn.toLowerCase().includes(term))
    );
  }, [data, q, pick]);

  const s = data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">On Proses</h1>
        <p className="mt-1 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <strong>Estimasi - belum masuk Uang Cair.</strong> Pesanan dalam pengiriman dan pesanan Selesai yang uangnya
          belum ada di Income Report, dari semua periode (tidak mengikuti filter Periode). Pesanan keluar dari sini
          otomatis setelah Income Report yang memuatnya diunggah.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Jumlah pesanan" value={s ? formatNumber(s.count) : "-"} />
        <SummaryCard tone="warning" label="Omzet pesanan (estimasi)" value={s ? formatRupiah(s.omzet) : "-"} />
        <SummaryCard label="Pesanan tertua" value={s?.oldestDays != null ? `${formatNumber(s.oldestDays)} hari` : "-"} />
      </div>

      {data && (
        <div className="card p-4">
          <p className="mb-2 text-xs font-medium text-gray-500">Kelompok per status &amp; umur (klik untuk menyaring)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ON_PROSES_GROUPS.map((st) => (
              <div key={st}>
                <p className="mb-1 text-sm font-semibold text-gray-800">{STATUS_LABEL[st]}</p>
                <div className="flex flex-wrap gap-2">
                  {AGE_BUCKETS.map((b) => {
                    const g = data.groups.find((x) => x.group === st && x.bucket === b);
                    const active = pick?.group === st && pick?.bucket === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setPick(active ? null : { group: st, bucket: b })}
                        className={`rounded-xl border px-3 py-1.5 text-left text-xs ${
                          active ? "border-neutral-900 bg-neutral-900 text-white" : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        <span className="block font-medium">{BUCKET_LABEL[b]}</span>
                        <span>
                          {formatNumber(g?.count ?? 0)} pesanan · {formatRupiah(g?.omzet ?? 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari No. Pesanan"
          aria-label="Cari No. Pesanan"
          className="w-full max-w-xs rounded-full border border-gray-200 px-4 py-2 text-sm"
        />
        {pick && (
          <button type="button" onClick={() => setPick(null)} className="btn-chip">
            Hapus saringan: {STATUS_LABEL[pick.group]} {BUCKET_LABEL[pick.bucket]}
          </button>
        )}
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Data On Proses gagal dimuat.</p>
      ) : (
        <DataTable<OnProsesRow>
          rowKey={(r) => `${r.storeCode}|${r.orderSn}`}
          rows={rows}
          emptyText={data ? "Tidak ada pesanan On Proses." : "Memuat…"}
          columns={[
            { header: "No. Pesanan", render: (r) => r.orderSn },
            { header: "Tanggal Dibuat", render: (r) => formatDate(r.orderCreatedAt) },
            { header: "Toko", render: (r) => r.storeCode },
            { header: "Produk", render: (r) => <span className="block max-w-[220px] truncate">{r.productName}</span> },
            { header: "Status", render: (r) => STATUS_LABEL[r.group] ?? r.group },
            { header: "Umur", render: (r) => `${formatNumber(r.ageDays)} hari` },
            { header: "Omzet Pesanan", render: (r) => formatRupiah(r.omzet) },
          ]}
        />
      )}
    </div>
  );
}
