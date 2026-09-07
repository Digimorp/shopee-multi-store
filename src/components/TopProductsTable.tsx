"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import { formatRupiah, formatNumber } from "@/lib/format";

type ProductRow = { sku: string; name: string; omzet: number; qty: number };

export default function TopProductsTable({ byOmzet, byQty }: { byOmzet: ProductRow[]; byQty: ProductRow[] }) {
  const [tab, setTab] = useState<"omzet" | "qty">("omzet");
  const rows = tab === "omzet" ? byOmzet : byQty;

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setTab("omzet")}
          className={`tab-pill ${tab === "omzet" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Nominal Omzet
        </button>
        <button
          onClick={() => setTab("qty")}
          className={`tab-pill ${tab === "qty" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Unit Terjual
        </button>
      </div>

      <DataTable
        rowKey={(r) => r.sku}
        rows={rows}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.name },
          { header: "Omzet", render: (r) => formatRupiah(r.omzet) },
          { header: "Unit Keluar", render: (r) => formatNumber(r.qty) },
        ]}
      />
    </div>
  );
}
