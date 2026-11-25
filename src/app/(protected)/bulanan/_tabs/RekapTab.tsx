"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import ExportButtons from "@/components/ExportButtons";
import TanpaHppNote, { sumTanpaHpp } from "@/components/TanpaHppNote";
import { formatRupiah } from "@/lib/format";
import { formatRupiahOrDash, shownProfitHpp } from "@/lib/hppDisplay";
import { PROFIT_BASIS_NOTE, rincianUangCairSub } from "@/lib/uangCairPeriode";

/** T-013 batch 13 (tugas X): semua saldo masuk periode + rincian (a)/(b)/(c) kecil di bawahnya. */
function UangCairCell({ r }: { r: any }) {
  return (
    <div>
      <div>{formatRupiah(r.uangCairTotal ?? 0)}</div>
      <div className="max-w-[260px] whitespace-normal text-[11px] leading-tight text-gray-400">
        {rincianUangCairSub(r.uangCairRincian)}
      </div>
    </div>
  );
}

export default function LaporanRekapPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "all";
  const [type, setType] = useState<"monthly" | "yearly">("monthly");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/reports/recap?type=${type}&storeId=${storeId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []));
  }, [type, storeId]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Rekap</h1>
      <p className="text-sm text-gray-500">
        Rekap bulanan mengikuti siklus cut-off (tgl 26 s/d tgl 25). Komparasi menunjukkan selisih omzet vs bulan
        tepat sebelumnya.
      </p>
      <p className="inline-block rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-800">
        <strong>Dasar tanggal: tanggal pesanan dibuat (WIB)</strong>, dikelompokkan per periode cut-off yang berlaku
        sekarang — sama dengan Laporan Profit dan Rekonsiliasi. Rekap selalu menampilkan semua bulan; Tahunan = jumlah
        12 bulan periodenya.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setType("monthly")}
            className={`tab-pill ${type === "monthly" ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            Bulanan (Cut-Off & Komparasi)
          </button>
          <button
            onClick={() => setType("yearly")}
            className={`tab-pill ${type === "yearly" ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            Tahunan (Multi-Toko)
          </button>
        </div>
        <ExportButtons report="recap" params={{ type }} />
      </div>

      {type === "monthly" ? (
        <DataTable
          rowKey={(r: any) => r.periodKey}
          rows={rows}
          columns={[
            { header: "Periode Cut-Off", render: (r) => r.label },
            { header: "Omzet Pesanan", render: (r) => formatRupiah(r.omzet) },
            { header: "Uang Cair (semua saldo masuk)", render: (r) => <UangCairCell r={r} /> },
            { header: "Profit HPP", render: (r) => formatRupiahOrDash(shownProfitHpp(r)) }, // T-013 temuan QA 2
            {
              header: "Selisih Omzet vs Bulan Lalu",
              // bulan tepat sebelumnya tidak ada data -> "-" (bukan 0%)
              render: (r) =>
                r.deltaOmzet == null ? (
                  <span className="text-gray-400">-</span>
                ) : (
                  <span className={r.deltaOmzet >= 0 ? "text-success-text" : "text-red-600"}>
                    {r.deltaOmzet >= 0 ? "▲" : "▼"} {formatRupiah(Math.abs(r.deltaOmzet))}
                    {r.deltaPct == null ? "" : ` (${r.deltaPct.toFixed(1)}%)`}
                  </span>
                ),
            },
          ]}
        />
      ) : (
        <DataTable
          rowKey={(r: any) => r.year}
          rows={rows}
          columns={[
            { header: "Tahun", render: (r) => r.year },
            { header: "Omzet Pesanan", render: (r) => formatRupiah(r.omzet) },
            { header: "Uang Cair (semua saldo masuk)", render: (r) => <UangCairCell r={r} /> },
            { header: "Profit HPP", render: (r) => formatRupiahOrDash(shownProfitHpp(r)) }, // T-013 temuan QA 2
          ]}
        />
      )}
      <p className="text-xs text-gray-500">{PROFIT_BASIS_NOTE}</p>
      <TanpaHppNote tanpaHpp={sumTanpaHpp(rows)} />
    </div>
  );
}
