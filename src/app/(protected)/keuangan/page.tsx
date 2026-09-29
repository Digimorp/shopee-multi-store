import { redirect } from "next/navigation";

// Halaman "Keuangan & Cashflow" sudah digabung ke /rekonsiliasi (Keuangan & Rekonsiliasi) —
// redirect ini biar link lama/bookmark tidak 404, sambil mempertahankan query filter.
export default function KeuanganRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/rekonsiliasi?${suffix}` : "/rekonsiliasi");
}
