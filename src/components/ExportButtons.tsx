"use client";

import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

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
      <button onClick={() => open("xlsx")} className="btn-primary">
        <Icon name="download" size={16} strokeWidth={2} />
        Export Excel
      </button>
      <button onClick={() => open("pdf")} className="btn-primary">
        <Icon name="fileText" size={16} strokeWidth={2} />
        Export PDF
      </button>
    </div>
  );
}
