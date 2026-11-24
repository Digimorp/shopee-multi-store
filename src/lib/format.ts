export function formatRupiah(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatNumber(n: number): string {
  return Math.round(n || 0).toLocaleString("id-ID");
}

/**
 * Label sumbu grafik yang ringkas & selalu terbaca penuh (T-013 butir 13):
 * 0, 500, 250 rb, 2,5 jt, 10 jt, 1,2 M. Hanya untuk label sumbu; nilai di tooltip tetap formatRupiah.
 */
export function formatAxisShort(n: number): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const fmt = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${fmt(v / 1e9)} M`;
  if (abs >= 1e6) return `${fmt(v / 1e6)} jt`;
  if (abs >= 1e3) return `${fmt(v / 1e3)} rb`;
  return fmt(Math.round(v));
}
