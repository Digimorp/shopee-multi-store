import { redirect } from "next/navigation";

// Halaman "Analisis Barang Keluar" sudah digabung ke /laporan-profit (Laporan Profit & Barang
// Keluar) — redirect ini biar link lama/bookmark tidak 404, sambil mempertahankan query filter.
export default function LaporanBarangKeluarRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/laporan-profit?${suffix}` : "/laporan-profit");
}
