"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SlidingTabs from "@/components/SlidingTabs";
import PageHeader from "@/components/PageHeader";
import { PERIOD_BASIS_NOTE, PERIOD_BASIS_NOTE_UANG_CAIR } from "@/lib/periodPicker";
import { BULANAN_TABS, filterQuery, hrefWithFilter, pickTab } from "@/components/navConfig";
import RekapTab from "./_tabs/RekapTab";
import UangCairTab from "./_tabs/UangCairTab";
import PerTokoTab from "./_tabs/PerTokoTab";
import ReturTab from "./_tabs/ReturTab";
import ProfitTab from "./_tabs/ProfitTab";

// T-013 batch 15 (bagian B): halaman induk Bulanan. Isi tiap tab = halaman lama apa adanya (dipindah
// ke _tabs/, logika tidak ditulis ulang). Semua tab mengikuti filter Periode + Toko di TopBar.
const CONTENT: Record<string, () => JSX.Element> = {
  rekap: RekapTab,
  "uang-cair": UangCairTab,
  "per-toko": PerTokoTab,
  retur: ReturTab,
  profit: ProfitTab,
};

export default function BulananPage() {
  const searchParams = useSearchParams();
  const tab = pickTab(BULANAN_TABS, searchParams.get("tab"));
  // Tab Profit diberi catatan selama HPP kosong: di periode/toko terpilih belum ada satu pun baris
  // berstatus Selesai yang SKU-nya punya HPP di Master Produk (semua masuk "tanpa HPP" -> profit "-").
  // Sumber: ringkasan API profit yang sama dengan isi tab (tanpa rumus baru).
  const filterQs = filterQuery(searchParams).toString();
  const [hppKosong, setHppKosong] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/reports/profit?${filterQs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d?.summary;
        if (!alive || !s?.tanpaHpp) return;
        setHppKosong(s.tanpaHpp.baris > 0 && Math.abs(s.tanpaHpp.uangCair - s.totalUangCair) < 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [filterQs]);

  const items = BULANAN_TABS.map((t) => ({
    key: t.key,
    label: t.key === "profit" && hppKosong ? `${t.label} (butuh HPP di Master Produk)` : t.label,
    href: hrefWithFilter("/bulanan", searchParams, { tab: t.key }),
  }));
  const Content = CONTENT[tab];

  return (
    <div className="space-y-5">
      {/* T-013 batch 16: total tab Uang Cair memakai tanggal uang masuk (batch 13), tab lain tanggal pesanan. */}
      <PageHeader
        title="Bulanan"
        sub={`Angka ${tab === "uang-cair" ? PERIOD_BASIS_NOTE_UANG_CAIR : PERIOD_BASIS_NOTE}.`}
        storeFilter
        controls={
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SlidingTabs ariaLabel="Laporan bulanan" items={items} activeKey={tab} size="sm" variant="tab" />
          </div>
        }
      />
      <Content />
    </div>
  );
}
