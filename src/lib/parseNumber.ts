/**
 * Angka nominal gaya Indonesia dari export Shopee.
 *
 * Di file resmi Shopee semua kolom nominal berupa STRING dengan TITIK sebagai
 * pemisah ribuan dan TANPA desimal, contoh: "1.361.250" -> 1361250, "22.500" -> 22500.
 * `parseFloat("1.361.250")` salah baca jadi 1.361 — makanya titik ribuan dibuang dulu.
 *
 * Tetap toleran terhadap format lain:
 *   - "12.345,67"  (ID, koma desimal)      -> 12345.67
 *   - "12,345.67"  (EN, koma ribuan)       -> 12345.67
 *   - "(1.000)" / "-1.000"  (negatif)      -> -1000
 *   - angka asli dari sel Excel             -> apa adanya
 */
export function parseIdNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s || s === "-") return 0;

  const negative = /^\(.*\)$/.test(s) || s.replace(/[^\d-]/g, "").startsWith("-") || /-\s*$/.test(s);
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return 0;

  if (s.includes(",") && s.includes(".")) {
    // Pemisah desimal = simbol yang muncul paling akhir.
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    // Hanya koma: anggap desimal ala Indonesia.
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    // Titik = pemisah ribuan kalau ada lebih dari satu titik, atau grup terakhir
    // tepat 3 digit ("165.000", "48.514"). Selain itu diperlakukan sebagai desimal ("22.5").
    if (parts.length > 2 || last.length === 3) s = parts.join("");
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}
