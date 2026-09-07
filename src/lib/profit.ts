export type ProfitInput = {
  qty: number;
  netSettlement: number;
  hpp: number; // per unit
  catalogPrice: number; // per unit, sebelum diskon 50%
};

/** Profit HPP (Nett) = Uang Cair Shopee - HPP. Hanya relevan untuk status SELESAI (uang cair). */
export function calcProfitHpp({ netSettlement, hpp, qty }: ProfitInput): number {
  return netSettlement - hpp * qty;
}

/** Profit Agen = Harga Katalog (diskon 50%) - HPP. Independen dari status pencairan. */
export function calcProfitAgen({ catalogPrice, hpp, qty }: ProfitInput): number {
  const hargaAgen = catalogPrice * 0.5;
  return (hargaAgen - hpp) * qty;
}

export function calcSelisihProfit(profitAgen: number, profitHpp: number): number {
  return profitAgen - profitHpp;
}
