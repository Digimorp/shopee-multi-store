import { requireOwnerPage } from "@/lib/pageGuard";

// T-013 nomor 10b: pagar Owner di SERVER (role dari DB, bukan dari cookie lama). Tampilan tidak berubah.
export default async function OwnerOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return children;
}
