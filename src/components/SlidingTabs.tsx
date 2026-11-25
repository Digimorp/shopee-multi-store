"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { slidePill } from "@/lib/slidePill";

export type SlidingTabItem = { key: string; label: string; href?: string };

type Props = {
  items: SlidingTabItem[];
  /** Key tab aktif. null = tidak ada tab yang cocok (mis. halaman Pengaturan) -> pill disembunyikan. */
  activeKey: string | null;
  /** Dipanggil untuk item TANPA href (mode toggle, bukan navigasi). */
  onSelect?: (key: string) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  /**
   * T-013 batch 18 (Kaca Lembut):
   *  - nav     = menu utama: jalur kaca, pil aktif hitam teks putih.
   *  - tab     = tab halaman (Bulanan / Pengaturan): pil kecil, aktif latar teal 12% teks teal.
   *  - segment = segmented control: kapsul abu tipis, aktif putih bertepi.
   */
  variant?: "nav" | "tab" | "segment";
  /** true = di layar < sm tab melebar penuh & dibagi rata (dipakai toggle periode). */
  stretch?: boolean;
  className?: string;
};

// Pill "disembunyikan" = clip-path tanpa luas.
const HIDDEN = "inset(50% 50% 50% 50% round 999px)";

const ITEM_BASE = "inline-flex items-center justify-center whitespace-nowrap rounded-full text-center font-semibold";
// Target sentuh >= 44px (min-h-11) di semua ukuran.
const SIZE = { md: "min-h-11 px-4 py-2.5 text-sm", sm: "min-h-11 px-3.5 py-2.5 text-sm" } as const;

const VARIANT = {
  nav: { track: "glass rounded-full p-1", idle: "text-muted hover:text-ink", pill: "bg-pill text-white", pillItem: "" },
  tab: { track: "rounded-full bg-white/50 p-1", idle: "text-muted hover:text-ink", pill: "bg-accent-soft text-accent-text", pillItem: "" },
  // Tepi tab aktif digambar di salinan label overlay (ring dalam), jadi ikut terpotong tepat di tab aktif.
  segment: { track: "rounded-full bg-ink/[0.06] p-1", idle: "text-muted hover:text-ink", pill: "bg-white text-ink", pillItem: "ring-1 ring-inset ring-ink/15" },
} as const;

/**
 * Tab/pill-toggle dengan indikator aktif yang geser + resize halus (slidePill, GSAP).
 *
 * Struktur 2 layer: layer dasar = tab asli (link/button, teks abu-abu); layer overlay (`pill`)
 * = salinan persis label yang sama berwarna terbalik (putih di atas hitam), seukuran container,
 * dan HANYA bagian di dalam clip-path (sekitar tab aktif) yang kelihatan. Karena kedua layer
 * memakai class ukuran yang sama, teks di overlay tepat menimpa teks tab di bawahnya.
 */
export default function SlidingTabs({
  items,
  activeKey,
  onSelect,
  ariaLabel,
  size = "md",
  variant = "nav",
  stretch = false,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const firstRun = useRef(true);
  // Sebelum pill terpasang (SSR + paint pertama) tab aktif diberi latar sendiri biar tidak "kedip" tanpa highlight.
  const [ready, setReady] = useState(false);

  const place = useCallback(
    (animate: boolean) => {
      const pill = pillRef.current;
      if (!pill) return;
      const target = activeKey ? itemRefs.current.get(activeKey) : undefined;
      if (!target) {
        gsap.set(pill, { clipPath: HIDDEN });
        (pill as any).__lr = undefined; // tab berikutnya muncul langsung, bukan geser dari posisi lama
        return;
      }
      slidePill(pill, target, animate);
    },
    [activeKey]
  );

  const placeRef = useRef(place);
  placeRef.current = place;

  // Tiap tab aktif berubah: geser pill. Pemasangan pertama = langsung (tanpa animasi).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    place(!firstRun.current && !reduce);
    firstRun.current = false;
    setReady(true);

    // Tab aktif di luar layar (mis. HP) -> gulirkan ke tengah.
    const wrap = wrapRef.current;
    const target = activeKey ? itemRefs.current.get(activeKey) : undefined;
    if (wrap && target && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollTo({
        left: target.offsetLeft - (wrap.clientWidth - target.offsetWidth) / 2,
        behavior: reduce ? "auto" : "smooth",
      });
    }
  }, [place, activeKey]);

  // Ukuran container berubah (font web selesai dimuat, lebar layar) -> posisi ulang TANPA animasi.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let first = true; // ResizeObserver selalu memanggil sekali saat observe(); abaikan.
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeRef.current(false);
    });
    ro.observe(el);
    document.fonts?.ready.then(() => placeRef.current(false));
    return () => ro.disconnect();
  }, []);

  const v = VARIANT[variant];
  const containerCls = stretch
    ? `relative flex w-full sm:inline-flex sm:w-auto ${v.track}`
    : `relative inline-flex w-max ${v.track}`;
  const itemCls = `${ITEM_BASE} ${SIZE[size]} ${stretch ? "flex-1 sm:flex-none" : "shrink-0"}`;

  return (
    <div
      ref={wrapRef}
      // Menu utama (nav) hanya perlu digeser di HP (< 820px). Di desktop tidak dijadikan wadah gulir:
      // blur kaca di dalam wadah gulir kehilangan sudut bulatnya di Chrome.
      className={`${stretch ? "" : variant === "nav" ? "max-[819px]:overflow-x-auto" : "overflow-x-auto"} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div ref={containerRef} role={onSelect ? "group" : undefined} aria-label={ariaLabel} className={containerCls}>
        {items.map((it) => {
          const active = it.key === activeKey;
          const cls = `relative z-0 ${itemCls} ${!ready && active ? v.pill : v.idle}`;
          const setRef = (el: HTMLElement | null) => {
            if (el) itemRefs.current.set(it.key, el);
            else itemRefs.current.delete(it.key);
          };
          return it.href ? (
            <Link key={it.key} ref={setRef} href={it.href} aria-current={active ? "page" : undefined} className={cls}>
              {it.label}
            </Link>
          ) : (
            <button key={it.key} ref={setRef} type="button" aria-pressed={active} onClick={() => onSelect?.(it.key)} className={cls}>
              {it.label}
            </button>
          );
        })}

        {/* Layer overlay: salinan label (tidak interaktif, disembunyikan dari screen reader). */}
        <div
          ref={pillRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 rounded-full p-1 ${v.pill}`}
          style={{ clipPath: HIDDEN }}
        >
          <div className="flex">
            {items.map((it) => (
              <span key={it.key} className={`${itemCls} ${v.pillItem}`}>
                {it.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
