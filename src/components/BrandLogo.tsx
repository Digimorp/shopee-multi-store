import Image from "next/image";

// T-013 batch 20: logo Penerbit Insan Kamil (milik Founder). Gambar = public/brand/logo-insan-kamil.png
// (margin putih dipangkas, 512x289, latar putih asli dipertahankan). Wadah putih membuat latar putih
// logo menyatu dengan kartu kaca, dan tetap terbaca di atas latar gradasi.
const SRC = "/brand/logo-insan-kamil.png";
const RATIO = 512 / 289;

const SIZES = {
  // Bar atas: gambar 40px + padding 2px = wadah 44px, sejajar pil menu/lonceng/avatar (h-11).
  // rounded-xl, bukan 22px: radius 22 pada wadah setinggi 44px jadi pil dan memotong sudut kotak kuning logo.
  sm: { h: 40, box: "rounded-xl px-1.5 py-0.5" },
  // Login: ~72px, radius sama dengan token kartu (22px).
  lg: { h: 72, box: "rounded-glass p-2.5" },
} as const;

export default function BrandLogo({ size = "sm", priority = false }: { size?: keyof typeof SIZES; priority?: boolean }) {
  const s = SIZES[size];
  const w = Math.round(s.h * RATIO);
  return (
    <span className={`inline-flex shrink-0 bg-white shadow-glass ring-1 ring-ink/[0.06] ${s.box}`}>
      <Image src={SRC} alt="Penerbit Insan Kamil" width={w} height={s.h} priority={priority} className="block" style={{ width: w, height: s.h }} />
    </span>
  );
}
