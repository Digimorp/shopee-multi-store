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
  /** true = di layar < sm tab melebar penuh & dibagi rata (dipakai toggle periode). */
  stretch?: boolean;
  className?: string;
};

// Pill "disembunyikan" = clip-path tanpa luas.
const HIDDEN = "inset(50% 50% 50% 50% round 999px)";

const ITEM_BASE = "whitespace-nowrap rounded-full text-center font-medium";
const SIZE = { md: "px-4 py-2 text-[13px]", sm: "px-2 py-1 text-xs sm:px-3" } as const;

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

  // Ukuran container berubah (font Poppins selesai dimuat, lebar layar) -> posisi ulang TANPA animasi.
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

  const containerCls = stretch
    ? "relative flex w-full rounded-full bg-neutral-100 p-1 sm:inline-flex sm:w-auto"
    : "relative inline-flex w-max rounded-full bg-neutral-100 p-1";
  const itemCls = `${ITEM_BASE} ${SIZE[size]} ${stretch ? "flex-1 sm:flex-none" : "shrink-0"}`;

  return (
    <div
      ref={wrapRef}
      className={`${stretch ? "" : "overflow-x-auto"} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div ref={containerRef} role={onSelect ? "group" : undefined} aria-label={ariaLabel} className={containerCls}>
        {items.map((it) => {
          const active = it.key === activeKey;
          const cls = `relative z-0 ${itemCls} outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            !ready && active ? "bg-neutral-950 text-white" : "text-neutral-500 hover:text-neutral-900"
          }`;
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
          className="pointer-events-none absolute inset-0 z-10 rounded-full bg-neutral-950 p-1 text-white"
          style={{ clipPath: HIDDEN }}
        >
          <div className="flex">
            {items.map((it) => (
              <span key={it.key} className={itemCls}>
                {it.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
