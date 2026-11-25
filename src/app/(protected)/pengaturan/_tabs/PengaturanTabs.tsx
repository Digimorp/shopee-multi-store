"use client";

import { useSearchParams } from "next/navigation";
import SlidingTabs from "@/components/SlidingTabs";
import { PENGATURAN_TABS, hrefWithFilter, pickTab } from "@/components/navConfig";
import TokoTab from "./TokoTab";
import ProdukTab from "./ProdukTab";
import UserTab from "./UserTab";
import StatusMappingSection from "./StatusMappingSection";
import PeriodSection from "./PeriodSection";
import LogTab from "./LogTab";

// T-013 batch 15 (bagian B): Pengaturan bertab. Isi tiap tab = halaman Pengaturan lama apa adanya
// (dipindah ke _tabs/). Tab "Aturan" = Mapping Status Pesanan + Period & Cut-Off.
function AturanTab() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Aturan</h1>
      <StatusMappingSection />
      <PeriodSection />
    </div>
  );
}

const CONTENT: Record<string, () => JSX.Element> = {
  toko: TokoTab,
  produk: ProdukTab,
  user: UserTab,
  aturan: AturanTab,
  log: LogTab,
};

export default function PengaturanTabs() {
  const searchParams = useSearchParams();
  const tab = pickTab(PENGATURAN_TABS, searchParams.get("tab"));
  const items = PENGATURAN_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: hrefWithFilter("/pengaturan", searchParams, { tab: t.key }),
  }));
  const Content = CONTENT[tab];
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <SlidingTabs ariaLabel="Pengaturan" items={items} activeKey={tab} size="sm" />
      </div>
      <Content />
    </div>
  );
}
