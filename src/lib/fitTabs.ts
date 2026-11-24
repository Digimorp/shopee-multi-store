/**
 * T-013 butir 12 / 12b: tab menu atas mana yang tampil dalam satu baris.
 * Yang tidak muat masuk menu "Lainnya".
 *
 * Aturan:
 * - Semua muat -> semua tampil, tanpa tombol Lainnya.
 * - Kurang ruang -> buang tab NON-pinned mulai dari urutan paling belakang sampai sisanya
 *   (+ tombol Lainnya) muat. Tab pinned TIDAK PERNAH dipindah ke Lainnya.
 * - Urutan tampil tidak berubah (mengikuti urutan `widths` = urutan navConfig).
 * - Minimal 1 tab tetap tampil.
 *
 * @param widths    lebar asli tiap tab (px), urut sesuai menu
 * @param available lebar ruang untuk tab + tombol Lainnya (px)
 * @param moreWidth lebar tombol "Lainnya" (px)
 * @param pinned    pinned[i] = true -> tab i selalu tampil
 * @param chrome    padding wadah tab (p-1 kiri+kanan = 8px)
 * @param gap       jarak wadah tab ke tombol Lainnya (px)
 * @returns visible[i] = true kalau tab i tampil di baris; false = masuk Lainnya
 */
export function fitTabs(
  widths: number[],
  available: number,
  moreWidth: number,
  pinned: boolean[] = [],
  chrome = 8,
  gap = 4
): boolean[] {
  const visible = widths.map(() => true);
  const total = widths.reduce((a, b) => a + b, 0);
  if (total + chrome <= available) return visible;

  const budget = available - chrome - gap - moreWidth;
  let used = total;
  for (let i = widths.length - 1; i >= 0 && used > budget; i--) {
    if (pinned[i]) continue;
    visible[i] = false;
    used -= widths[i];
  }
  if (!visible.some(Boolean) && visible.length > 0) visible[0] = true;
  return visible;
}
