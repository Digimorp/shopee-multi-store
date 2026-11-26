import { formatRupiah } from "@/lib/format";
import { UANG_CAIR_LABEL, formatSaldoKeluar, type RincianUangCairJson } from "@/lib/uangCairPeriode";

// Tiga bagian rincian batch 13 (a)/(b)/(c), apa adanya -- tanpa hitungan baru.
const PARTS = [
  { key: "pesananPeriodeIni", label: "Pesanan periode ini", color: "#17A398" },
  { key: "pesananLain", label: "Pesanan periode lain / belum diunggah", color: "#B9E5E0" },
  { key: "penyesuaian", label: "Penyesuaian", color: "#8B7CF6" },
] as const;

/**
 * T-013 batch 18 (Kaca Lembut): kartu utama Uang Cair = angka besar + bar rincian tiga warna + daftar.
 * Bar hanya menggambar bagian bernilai positif (proporsi); nilai sebenarnya (termasuk minus) ada di daftar.
 */
export default function UangCairCard({ rincian, loading }: { rincian: RincianUangCairJson | null | undefined; loading: boolean }) {
  const positives = rincian ? PARTS.map((p) => Math.max(0, rincian[p.key])) : [];
  const sumPos = positives.reduce((s, v) => s + v, 0);
  const keluar = formatSaldoKeluar(rincian);

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink">Uang Cair</h2>
      <p className="text-xs text-muted">{UANG_CAIR_LABEL}</p>
      <p className="num mt-2 break-words text-[32px] font-bold leading-tight text-ink">
        {rincian ? formatRupiah(rincian.total) : loading ? "…" : "-"}
      </p>

      {rincian && (
        <>
          <div
            className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-ink/[0.06]"
            role="img"
            aria-label="Rincian Uang Cair: pesanan periode ini, pesanan periode lain, penyesuaian"
          >
            {sumPos > 0 &&
              PARTS.map((p, i) =>
                positives[i] > 0 ? (
                  <span key={p.key} style={{ width: `${(positives[i] / sumPos) * 100}%`, background: p.color }} />
                ) : null
              )}
          </div>
          <ul className="mt-4 space-y-2.5">
            {PARTS.map((p) => {
              const v = rincian[p.key];
              return (
                <li key={p.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-start gap-2 text-ink">
                    <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                    {p.label}
                  </span>
                  <span className={`num shrink-0 font-semibold ${v < 0 ? "text-danger-text" : "text-ink"}`}>{formatRupiah(v)}</span>
                </li>
              );
            })}
          </ul>
          {keluar && <p className="mt-3 text-xs text-muted">{keluar}</p>}
        </>
      )}
    </div>
  );
}
