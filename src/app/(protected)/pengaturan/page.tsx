import { requireOwnerPage } from "@/lib/pageGuard";
import PengaturanTabs from "./_tabs/PengaturanTabs";

// T-013 batch 15 (bagian B): Pengaturan khusus Owner -- dicek di SERVER dari DB (bukan hanya menu
// disembunyikan). Admin Toko -> /dashboard. Middleware juga menolak /pengaturan untuk non-Owner.
export default async function PengaturanPage() {
  await requireOwnerPage();
  return <PengaturanTabs />;
}
