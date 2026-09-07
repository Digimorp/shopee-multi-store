"use client";

import { useSearchParams } from "next/navigation";

/**
 * Tombol Export Excel / PDF untuk sebuah laporan.
 * Meneruskan filter aktif (storeId, from, to) + param tambahan (tab / type).
 */
export default function ExportButtons({
  report,
  params = {},
}: {
  report: "cashflow" | "profit" | "barang-keluar" | "retur" | "performa-toko" | "recap" | "orders";
  params?: Record<string, string>;
}) {
  const searchParams = useSearchParams();

  function open(format: "xlsx" | "pdf") {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("report", report);
    qs.set("format", format);
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    window.open(`/api/reports/export?${qs.toString()}`, "_blank");
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => open("xlsx")}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Export Excel
      </button>
      <button
        onClick={() => open("pdf")}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Export PDF
      </button>
    </div>
  );
}
