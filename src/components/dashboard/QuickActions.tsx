"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

/**
 * T-013 batch 18: dari tiga pintasan lama ("Lihat Order", "Butuh Perhatian", "Laporan") hanya
 * "Butuh Perhatian" yang dipertahankan -- dua lainnya dobel dengan menu Upload Data & Bulanan.
 * Kini sekaligus kartu angka Selisih: jumlah pesanan SELISIH + link ke tab Uang Cair tersaring SELISIH.
 * Filter toko & periode aktif ikut dibawa.
 */
export default function QuickActions({ selisihCount }: { selisihCount?: number }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", "uang-cair");
  params.set("reconTab", "SELISIH");

  return (
    <div className="card flex flex-col p-5 sm:p-6">
      <p className="text-xs font-semibold text-muted">Selisih (perlu dicek)</p>
      <p className="num mt-2 break-words text-[28px] font-bold leading-tight text-ink">
        {selisihCount === undefined ? "-" : `${formatNumber(selisihCount)} pesanan`}
      </p>
      <p className="mt-1 text-xs text-muted">sudah termasuk di Cair</p>
      <Link
        href={`/bulanan?${params.toString()}`}
        className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-sm font-bold text-accent-text hover:underline"
      >
        Cek di Uang Cair
        <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
