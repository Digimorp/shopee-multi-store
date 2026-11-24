/**
 * T-013 butir 12: berapa tab menu atas yang muat dalam satu baris.
 * Sisanya masuk menu "Lainnya" (urutan tidak berubah: k tab pertama tampil, sisanya di Lainnya).
 *
 * @param widths   lebar asli tiap tab (px), urut sesuai menu
 * @param available lebar ruang yang tersedia untuk tab + tombol Lainnya (px)
 * @param moreWidth lebar tombol "Lainnya" (px)
 * @param chrome   padding wadah tab (p-1 kiri+kanan = 8px)
 * @param gap      jarak antara wadah tab dan tombol Lainnya (px)
 * @returns jumlah tab yang tampil (minimal 1). Sama dengan widths.length = semua muat, tanpa Lainnya.
 */
export function fitTabs(widths: number[], available: number, moreWidth: number, chrome = 8, gap = 4): number {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total + chrome <= available) return widths.length;
  let used = chrome + gap + moreWidth;
  let k = 0;
  while (k < widths.length && used + widths[k] <= available) used += widths[k++];
  return Math.max(1, k);
}
