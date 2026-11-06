"use client";

import { useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import { RankBadge } from "@/components/SummaryCard";
import { formatRupiah, formatNumber } from "@/lib/format";

type ProductRow = { sku: string; name: string; omzet: number; qty: number };

export default function TopProductsTable({ byOmzet, byQty }: { byOmzet: ProductRow[]; byQty: ProductRow[] }) {
  const [tab, setTab] = useState<"omzet" | "qty">("omzet");
  // Peringkat dari posisi di daftar penuh (bukan index per halaman pagination).
  const rows = useMemo(() => (tab === "omzet" ? byOmzet : byQty).map((r, i) => ({ ...r, rank: i + 1 })), [tab, byOmzet, byQty]);

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
        rowKey={(r) => `${r.rank}-${r.sku}`} // SKU bisa kosong/duplikat di data -> key pakai peringkat
        rows={rows}
        columns={[
          { header: "#", render: (r) => <RankBadge rank={r.rank} /> },
          { header: "SKU", render: (r) => r.sku },
          { header: "Produk", render: (r) => r.name },
          { header: "Omzet", render: (r) => formatRupiah(r.omzet) },
          { header: "Unit Keluar", render: (r) => formatNumber(r.qty) },
        ]}
      />
    </div>
  );
}
