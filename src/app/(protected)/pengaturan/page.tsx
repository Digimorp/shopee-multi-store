import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/pageGuard";
import { pengaturanTabsForRole } from "@/components/navConfig";
import PengaturanTabs from "./_tabs/PengaturanTabs";

// T-013 batch 21: Pengaturan untuk Owner DAN Admin Toko, dicek di SERVER dari DB (bukan hanya menu).
// Admin Toko hanya tab Toko + Produk & HPP; membuka tab Owner lewat URL langsung (?tab=user / aturan /
// log) -> dialihkan ke /pengaturan. API User / Aturan / Log tetap menolak non-Owner sendiri (403).
export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePageUser();
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : null;
  const allowed = pengaturanTabsForRole(user.role).map((t) => t.key);
  if (tab && !allowed.includes(tab)) redirect("/pengaturan");
  return <PengaturanTabs role={user.role} />;
}
