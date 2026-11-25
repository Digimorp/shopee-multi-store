import StoreChips from "@/components/StoreChips";

/**
 * T-013 batch 18 (Kaca Lembut): kepala halaman baku.
 *  1. Judul besar di kiri (+ keterangan), `aside` (mis. baris angka ringkas) di kanan sejajar judul;
 *     di layar sempit `aside` turun ke bawah judul.
 *  2. Baris kontrol: `controls` (segmented control / tab) di kiri, `actions` (tombol Export hitam) di kanan.
 *  3. Baris chip toko (opsional) untuk halaman yang mengikuti filter Toko.
 */
export default function PageHeader({
  title,
  sub,
  aside,
  controls,
  actions,
  storeFilter = false,
}: {
  title: string;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
  controls?: React.ReactNode;
  actions?: React.ReactNode;
  storeFilter?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-ink sm:text-[30px]">{title}</h1>
          {sub && <p className="mt-1 text-sm text-muted-deep">{sub}</p>}
        </div>
        {aside && <div className="w-full xl:w-auto">{aside}</div>}
      </div>
      {(controls || actions) && (
        <div className="flex flex-wrap items-center gap-3">
          {controls && <div className="min-w-0 max-w-full">{controls}</div>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {storeFilter && <StoreChips />}
    </div>
  );
}
