"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SlidingTabs from "@/components/SlidingTabs";
import { BULANAN_TABS, hrefWithFilter, pickTab } from "@/components/navConfig";
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
  // Tab Profit diberi catatan selama belum ada produk ber-HPP di Master Produk.
  const [hppKosong, setHppKosong] = useState(false);
  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHppKosong(!(d.products ?? []).some((p: any) => (p.hpp ?? 0) > 0)))
      .catch(() => {});
  }, []);

  const items = BULANAN_TABS.map((t) => ({
    key: t.key,
    label: t.key === "profit" && hppKosong ? `${t.label} (butuh HPP di Master Produk)` : t.label,
    href: hrefWithFilter("/bulanan", searchParams, { tab: t.key }),
  }));
  const Content = CONTENT[tab];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <SlidingTabs ariaLabel="Laporan bulanan" items={items} activeKey={tab} size="sm" />
      </div>
      <Content />
    </div>
  );
}
