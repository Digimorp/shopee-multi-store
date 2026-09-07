export type ProfitHppInput = {
  qty: number;
  netSettlement: number; // Uang cair Shopee (setelah biaya admin) untuk baris ini
  hpp: number; // HPP per unit (snapshot)
};

export type ProfitAgenInput = {
  qty: number;
  hpp: number; // HPP per unit (snapshot)
  catalogPrice: number; // Harga katalog per unit, sebelum diskon 50% (snapshot)
};

/** Profit HPP (Nett) = Uang Cair Shopee - (HPP x qty). Hanya relevan untuk status SELESAI (uang cair). */
export function calcProfitHpp({ netSettlement, hpp, qty }: ProfitHppInput): number {
  return netSettlement - hpp * qty;
}

/** Profit Agen = (Harga Katalog x 50% - HPP) x qty. Independen dari status pencairan. */
export function calcProfitAgen({ catalogPrice, hpp, qty }: ProfitAgenInput): number {
  const hargaAgen = catalogPrice * 0.5;
  return (hargaAgen - hpp) * qty;
}

export function calcSelisihProfit(profitAgen: number, profitHpp: number): number {
  return profitAgen - profitHpp;
}
