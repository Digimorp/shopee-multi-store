import {
  addMonths,
  format,
  setDate,
  subMonths,
} from "date-fns";

export type Period = { from: Date; to: Date; key: string };

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** Bikin objek Period dari tanggal awal & akhir. Key dipakai sebagai grouping id di DB. */
export function makePeriod(from: Date, to: Date): Period {
  return { from, to, key: `${fmt(from)}_${fmt(to)}` };
}

/**
 * Periode cut-off default aplikasi: tanggal 26 bulan lalu s/d tanggal 25 bulan ini,
 * sesuai siklus laporan Shopee multi-toko.
 */
export function getDefaultPeriod(cutoffDay = 25, now = new Date()): Period {
  const to = setDate(now, cutoffDay);
  const from = setDate(subMonths(now, 1), cutoffDay + 1);
  return makePeriod(from, to);
}

/**
 * @deprecated T-013 butir 19: memakai zona jam SERVER (di Vercel = UTC), jadi pesanan 25/26 jam
 * 00:00-06:59 WIB bisa masuk periode yang salah. Untuk periode pesanan pakai getPeriodForDateWib().
 * Tidak dihapus (dipertahankan untuk referensi / kompatibilitas).
 * Tentukan periode cut-off untuk sebuah tanggal transaksi.
 * Kalau tanggal <= cutoffDay -> masuk periode (26 bulan sebelumnya s/d cutoffDay bulan ini).
 * Kalau tanggal > cutoffDay -> masuk periode (26 bulan ini s/d cutoffDay bulan depan).
 */
export function getPeriodForDate(date: Date, cutoffDay = 25): Period {
  const day = date.getDate();
  if (day <= cutoffDay) {
    const to = setDate(date, cutoffDay);
    const from = setDate(subMonths(date, 1), cutoffDay + 1);
    return makePeriod(from, to);
  }
  const to = setDate(addMonths(date, 1), cutoffDay);
  const from = setDate(date, cutoffDay + 1);
  return makePeriod(from, to);
}

export function formatPeriodLabel(period: Period): string {
  return `${format(period.from, "d MMM yyyy")} - ${format(period.to, "d MMM yyyy")}`;
}

export function parsePeriodKey(key: string): Period {
  const [fromStr, toStr] = key.split("_");
  return makePeriod(new Date(fromStr), new Date(toStr));
}

// ---------------------------------------------------------------------------
// Periode bulanan cut-off dalam WIB (Asia/Jakarta, UTC+7, tanpa DST).
// Dihitung dengan aritmetika UTC murni, jadi hasilnya sama di server mana pun
// (lokal WIB maupun Vercel UTC). Fungsi-fungsi di atas tidak diubah.
// ---------------------------------------------------------------------------

const WIB_OFFSET_HOURS = 7;

const BULAN_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Jumlah hari di bulan (month0 = 0..11, boleh di luar rentang — dinormalisasi). */
function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Tanggal cut-off di sebuah bulan, dipotong ke hari terakhir bulan itu (mis. cutoff 30 di Februari -> 28/29). */
function cutoffDateOf(year: number, month0: number, cutoffDay: number): Date {
  const day = Math.min(cutoffDay, daysInMonth(year, month0));
  return new Date(Date.UTC(year, month0, day)); // tanggal kalender saja (jam 00:00 UTC)
}

/**
 * Periode cut-off untuk sebuah bulan "YYYY-MM" (= bulan AKHIR periode), dalam WIB.
 * Contoh cutoffDay 25: "2027-01" -> 26 Des 2026 00:00:00.000 WIB s/d 25 Jan 2027 23:59:59.999 WIB.
 * Kalau cutoffDay melebihi jumlah hari sebuah bulan, cut-off jatuh di hari terakhir bulan itu,
 * dan periode berikutnya mulai keesokan harinya (periode selalu bersambung, tanpa celah/tumpang tindih).
 * Key memakai format yang sama dengan periodKey tersimpan: "YYYY-MM-DD_YYYY-MM-DD" (tanggal WIB).
 */
export function getPeriodForMonth(month: string, cutoffDay = 25): Period {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Format bulan tidak valid: "${month}" (harus YYYY-MM)`);
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) throw new Error(`Bulan tidak valid: "${month}"`);
  if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
    throw new Error(`cutoffDay tidak valid: ${cutoffDay} (harus 1-31)`);
  }

  const endDate = cutoffDateOf(year, month0, cutoffDay); // tgl cut-off bulan ini
  const prevCutoff = cutoffDateOf(year, month0 - 1, cutoffDay); // tgl cut-off bulan sebelumnya
  const startDate = new Date(prevCutoff.getTime() + 86_400_000); // keesokan harinya

  const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

  // 00:00:00.000 WIB = 17:00 UTC hari sebelumnya; 23:59:59.999 WIB = 16:59:59.999 UTC hari yang sama.
  const from = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), -WIB_OFFSET_HOURS)
  );
  const to = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23 - WIB_OFFSET_HOURS, 59, 59, 999)
  );

  return { from, to, key: `${ymd(startDate)}_${ymd(endDate)}` };
}

/**
 * Bulan periode cut-off (format "YYYY-MM", = bulan AKHIR periode) untuk sebuah tanggal, dalam WIB.
 * Kebalikan getPeriodForMonth: tanggal d selalu ada di dalam getPeriodForMonth(hasil, cutoffDay).
 * Mis. cutoff 25: 25 Agu 23:59 WIB -> "2026-08", 26 Agu 00:00 WIB -> "2026-09";
 * 31 Des 2026 23:30 WIB -> "2027-01". Tidak bergantung zona waktu server.
 */
export function getPeriodMonthForDate(date: Date, cutoffDay = 25): string {
  const wib = new Date(date.getTime() + WIB_OFFSET_HOURS * 3_600_000); // komponen UTC = jam dinding WIB
  let y = wib.getUTCFullYear();
  let m0 = wib.getUTCMonth();
  if (wib.getUTCDate() > Math.min(cutoffDay, daysInMonth(y, m0))) {
    m0++;
    if (m0 > 11) {
      m0 = 0;
      y++;
    }
  }
  return `${y}-${pad2(m0 + 1)}`;
}

/**
 * T-013 butir 19: periode cut-off (from/to/key) untuk sebuah tanggal, dalam WIB — SATU sumber untuk
 * periodKey saat upload, cek kunci periode, Rekap, dan filter period=YYYY-MM (resolveFilters).
 * Key formatnya sama dengan periodKey tersimpan: "YYYY-MM-DD_YYYY-MM-DD" (tanggal WIB).
 */
export function getPeriodForDateWib(date: Date, cutoffDay = 25): Period {
  return getPeriodForMonth(getPeriodMonthForDate(date, cutoffDay), cutoffDay);
}

/** Bulan "YYYY-MM" sebelumnya, mis. "2027-01" -> "2026-12". */
export function prevPeriodMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}

/**
 * Bulan periode cut-off yang sedang berjalan menurut WIB, format "YYYY-MM"
 * (bulan AKHIR periode). Mis. cutoff 25: 25 Jan 23:59 WIB -> "2027-01", 26 Jan 00:00 WIB -> "2027-02".
 * Dipakai server (resolveFilters) DAN browser (TopBar) supaya default periodenya selalu sama.
 */
export function getCurrentPeriodMonth(cutoffDay = 25, now = new Date()): string {
  const wib = new Date(now.getTime() + WIB_OFFSET_HOURS * 3_600_000); // komponen UTC-nya = jam dinding WIB
  let y = wib.getUTCFullYear();
  let m = wib.getUTCMonth() + 1;
  const ym = () => `${y}-${pad2(m)}`;
  if (now > getPeriodForMonth(ym(), cutoffDay).to) {
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return ym();
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * T-013 batch 16: NAMA periode = rentang tanggal, mis. "26 Jun - 25 Jul 2026"; kalau tahun beda
 * "26 Des 2026 - 25 Jan 2027". Dibaca dari period.key ("YYYY-MM-DD_YYYY-MM-DD", tanggal WIB), jadi
 * tidak bergeser karena zona waktu server. Dipakai SEMUA tampilan & export (bukan nama bulan saja).
 */
export function formatPeriodRangeLabel(period: Pick<Period, "key">): string {
  const parts = period.key.split("_");
  const parse = (ymd: string | undefined) => {
    const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
    if (!m) throw new Error(`Key periode tidak valid: "${period.key}"`);
    return { y: Number(m[1]), label: `${Number(m[3])} ${BULAN_PENDEK[Number(m[2]) - 1]}` };
  };
  const a = parse(parts[0]);
  const b = parse(parts[1]);
  return a.y === b.y ? `${a.label} - ${b.label} ${b.y}` : `${a.label} ${a.y} - ${b.label} ${b.y}`;
}

/** Rentang dua tanggal (Date) dengan format nama periode, dibaca dalam WIB. */
export function formatDateRangeLabel(from: Date | string, to: Date | string): string {
  const ymdWib = (d: Date | string) =>
    new Date(new Date(d).getTime() + WIB_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
  return formatPeriodRangeLabel({ key: `${ymdWib(from)}_${ymdWib(to)}` });
}

/**
 * @deprecated T-013 batch 16: nama bulan saja membingungkan (26 Jun-25 Jul jadi "Juli 2026").
 * Pakai formatPeriodRangeLabel. Dibiarkan hanya untuk test lama.
 *
 * Label periode = nama bulan AKHIR periode dalam bahasa Indonesia, mis. "Januari 2027".
 * Dibaca dari bagian akhir key ("..._YYYY-MM-DD"), bukan dari Date, supaya tidak bergeser
 * karena zona waktu server — berlaku untuk Period dari getPeriodForMonth maupun periodKey tersimpan.
 */
export function formatPeriodMonthLabel(period: Period): string {
  const toStr = period.key.split("_")[1] ?? "";
  const m = /^(\d{4})-(\d{2})/.exec(toStr);
  if (!m) throw new Error(`Key periode tidak valid: "${period.key}"`);
  return `${BULAN_ID[Number(m[2]) - 1]} ${m[1]}`;
}
