"use client";

import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatNumber } from "@/lib/format";

// Floating panel (strata di atas card data yang flat): hampir putih polos, dengan gradasi diagonal
// SANGAT tipis dan dingin — abu-mint pucat #DFEDEB (kiri atas) ke putih hangat #F9FAF7 (kanan
// bawah), diukur dari video referensi. Tanpa saturasi tinggi: dari jauh terbaca putih, baru
// terasa "ada sesuatu" kalau dilihat dekat. Bayangan panjang yang lembut yang membuatnya mengambang.
// Subtitle (satu-satunya teks yang langsung di atas gradasi) memakai neutral-600: di atas mint
// pucat kontrasnya ~6,5:1, sedangkan neutral-500 hanya ~3,9:1. Teks di dalam tile tak terpengaruh
// karena tile hampir putih (white/80).
// SENGAJA tidak memakai class `.card` — di bawah `.theme-mono`, `.card` memaksa box-shadow:none.
// `self-start` mencegah panel ikut melar setinggi daftar Pesanan Terbaru di sebelahnya, dan
// `lg:sticky` membuatnya tetap terlihat (mengambang) selagi daftar pesanan di-scroll.
const PANEL =
  "self-start rounded-3xl bg-gradient-to-br from-[#DFEDEB] to-[#F9FAF7] p-6 ring-1 ring-black/5 " +
  "shadow-[0_28px_56px_-18px_rgba(10,10,10,0.34),0_10px_24px_-10px_rgba(10,10,10,0.14)] lg:sticky lg:top-6";

const TILE = "rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(10,10,10,0.04)]";

function Note({ tone = "muted", children }: { tone?: "muted" | "error"; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-2xl bg-white/60 px-4 py-8 text-center text-sm ring-1 ring-black/[0.04] ${
        tone === "error" ? "text-amber-600" : "text-neutral-400"
      }`}
    >
      {children}
    </p>
  );
}

export default function ActivityCard({
  logs,
  loading,
  error = false,
}: {
  logs: any[];
  loading: boolean;
  error?: boolean;
}) {
  return (
    <div className={PANEL}>
      <p className="text-sm font-semibold text-neutral-900">Aktivitas Terbaru</p>
      <p className="mt-0.5 text-xs text-neutral-600">Riwayat impor data pesanan</p>

      <div className="mt-5">
        {loading ? (
          <Note>Memuat…</Note>
        ) : error && logs.length === 0 ? (
          <Note tone="error">Gagal memuat aktivitas.</Note>
        ) : logs.length === 0 ? (
          <Note>Belum ada aktivitas impor.</Note>
        ) : (
          <ul className="space-y-3">
            {logs.slice(0, 6).map((l, i) => {
              const failed = (l.failedRows ?? 0) > 0;
              return (
                <li key={l.id ?? i} className={TILE}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">{l.store?.code ?? "-"}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                        failed
                          ? "bg-amber-50 text-amber-700 ring-amber-600/15"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                      }`}
                    >
                      {failed ? "Ada dilewati" : "Berhasil"}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-neutral-600">
                    {formatNumber(l.successRows ?? 0)} baris pesanan diimpor
                    {failed && <span className="font-medium text-amber-700"> · {formatNumber(l.failedRows)} dilewati</span>}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span
                      title={l.fileName}
                      className="min-w-0 truncate rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-500"
                    >
                      {l.fileName}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {l.createdAt
                        ? formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })
                        : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
