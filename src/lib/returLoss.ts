/**
 * T-013 butir 16: beban kerugian HPP retur rusak.
 * Aturan "HPP 0 = tidak diketahui": retur rusak dengan hppSnapshot <= 0 TIDAK dianggap
 * kerugian 0 — kerugiannya tidak diketahui (null), tidak dijumlah ke total, dan dihitung
 * sebagai baris tanpaHpp. Rumus untuk HPP yang diketahui tetap hpp x qty.
 * Pure (tanpa prisma) supaya bisa dipakai di API, export, dan halaman client.
 */
export type ReturLossInput = { status?: string; returCondition: string | null; hppSnapshot: number; qty: number };

export const isReturRusak = (o: ReturLossInput) =>
  o.returCondition === "DAMAGED" && (o.status === undefined || o.status === "RETUR");

/** Kerugian HPP 1 baris: angka bila retur rusak ber-HPP, null bila retur rusak tanpa HPP, 0 bila bukan retur rusak. */
export function returLoss(o: ReturLossInput): number | null {
  if (!isReturRusak(o)) return 0;
  return o.hppSnapshot > 0 ? o.hppSnapshot * o.qty : null;
}

/** Total kerugian (hanya baris ber-HPP) + jumlah baris retur rusak tanpa HPP. */
export function sumReturLoss(rows: ReturLossInput[]): { kerugianHpp: number; tanpaHpp: { baris: number } } {
  let kerugianHpp = 0;
  let baris = 0;
  for (const o of rows) {
    if (!isReturRusak(o)) continue;
    const v = returLoss(o);
    if (v == null) baris++;
    else kerugianHpp += v;
  }
  return { kerugianHpp, tanpaHpp: { baris } };
}
