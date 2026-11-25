import { redirect } from "next/navigation";
import { legacyRedirectUrl } from "@/components/navConfig";

// T-013 batch 15: route lama tetap hidup sebagai redirect ke halaman bertab (query filter ikut).
// Tujuan: lihat LEGACY_ROUTES["/settings/periods"] di src/components/navConfig.ts.
export default function LegacyRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(legacyRedirectUrl("/settings/periods", searchParams));
}
