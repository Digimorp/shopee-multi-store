"use client";

import { useSearchParams } from "next/navigation";
import SlidingTabs from "@/components/SlidingTabs";
import PageHeader from "@/components/PageHeader";
import { hrefWithFilter, pengaturanTabsForRole, pickTab } from "@/components/navConfig";
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
      <h2 className="text-xl font-bold text-ink">Aturan</h2>
      <StatusMappingSection />
      <PeriodSection />
    </div>
  );
}

type Role = "OWNER" | "ADMIN_TOKO";
const CONTENT: Record<string, (p: { role: Role }) => JSX.Element> = {
  toko: TokoTab,
  produk: ProdukTab,
  user: UserTab,
  aturan: AturanTab,
  log: LogTab,
};

// T-013 batch 21: tab per peran (role dari server, sudah dicek di DB). Admin Toko: Toko + Produk & HPP.
export default function PengaturanTabs({ role }: { role: Role }) {
  const searchParams = useSearchParams();
  const tabs = pengaturanTabsForRole(role);
  const tab = pickTab(tabs, searchParams.get("tab"));
  const items = tabs.map((t) => ({
    key: t.key,
    label: t.label,
    href: hrefWithFilter("/pengaturan", searchParams, { tab: t.key }),
  }));
  const Content = CONTENT[tab];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan"
        controls={
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SlidingTabs ariaLabel="Pengaturan" items={items} activeKey={tab} size="sm" variant="tab" />
          </div>
        }
      />
      <Content role={role} />
    </div>
  );
}
