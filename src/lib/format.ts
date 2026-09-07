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
