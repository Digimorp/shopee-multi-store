"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SlidingTabs, { type SlidingTabItem } from "@/components/SlidingTabs";
import { Icon } from "@/components/icons";
import { fitTabs } from "@/lib/fitTabs";

// Class ukuran tab SAMA dengan SlidingTabs size "md" (ITEM_BASE + SIZE.md) supaya hasil ukur = lebar asli.
const TAB_CLS =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-center font-semibold min-h-11 px-4 py-2.5 text-sm";
// T-013 batch 18: di bawah 820px (HP) semua pil tampil dan bisa digeser horizontal -- tanpa "Lainnya".
const SCROLL_BELOW = 820;
const MORE_LABEL = "Lainnya";
// T-013 butir 12b (keputusan Founder): tab ini selalu tampil di baris menu, tidak pernah masuk "Lainnya".
// T-013 batch 15: Retur & Batal kini tab di halaman Bulanan -> yang di-pin menu Bulanan.
const PINNED_KEYS = new Set(["/bulanan"]);

// useLayoutEffect di browser (ukur sebelum paint), useEffect saat SSR (hindari warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * T-013 butir 12: tab menu atas yang tidak terpotong di layar laptop.
 * Tab yang muat tampil seperti biasa (SlidingTabs, tidak diubah); tab yang tidak muat pindah ke
 * menu "Lainnya" di ujung kanan, urutan tetap sama. Kalau semua muat, tombol Lainnya tidak ada.
 * Tab pinned (PINNED_KEYS) tidak pernah masuk Lainnya; yang dipindah tab lain dari paling belakang.
 */
export default function TopNavTabs({
  items,
  activeKey,
  className = "",
}: {
  items: SlidingTabItem[];
  activeKey: string | null;
  className?: string;
}) {
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // visible[i] = tab i tampil di baris; awalnya semua (SSR), diukur ulang sebelum paint.
  const [visible, setVisible] = useState<boolean[]>(() => items.map(() => true));
  const [open, setOpen] = useState(false);
  // items dibuat ulang tiap render TopBar; ukur ulang hanya kalau labelnya berubah.
  const labelsKey = items.map((it) => it.label).join("|");

  // Ukur lebar asli tiap tab (salinan tersembunyi) + lebar ruang -> berapa yang muat.
  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const recompute = () => {
      const nodes = [...measure.children] as HTMLElement[];
      const widths = nodes.slice(0, items.length).map((n) => n.getBoundingClientRect().width);
      const moreWidth = nodes[items.length]?.getBoundingClientRect().width ?? 0;
      const pinned = items.map((it) => PINNED_KEYS.has(it.key));
      const next =
        window.innerWidth < SCROLL_BELOW ? items.map(() => true) : fitTabs(widths, box.clientWidth, moreWidth, pinned);
      setVisible((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(box);
    document.fonts?.ready.then(recompute);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey]);

  // Tutup menu saat pindah halaman, klik di luar, atau Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Urutan tetap sama seperti items (navConfig); hanya dipisah tampil / Lainnya.
  const shown = items.filter((_, i) => visible[i] !== false);
  const overflow = items.filter((_, i) => visible[i] === false);
  const overflowActive = overflow.some((it) => it.key === activeKey);

  return (
    <div ref={boxRef} className={`relative flex min-w-0 items-center gap-1 ${className}`}>
      {/* Salinan tak terlihat untuk mengukur lebar asli semua tab + tombol Lainnya.
          T-013 batch 17: dibungkus wadah 0x0 overflow-hidden supaya salinan ini tidak melebarkan halaman
          di layar HP (lebar tab tetap terukur dari offsetWidth, tidak terpengaruh pemotongan). */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
      <div ref={measureRef} className="flex w-max">
        {items.map((it) => (
          <span key={it.key} className={TAB_CLS}>
            {it.label}
          </span>
        ))}
        <span className={`${TAB_CLS} gap-1`}>
          {MORE_LABEL}
          <Icon name="chevronDown" size={14} />
        </span>
      </div>
      </div>

      <SlidingTabs
        ariaLabel="Navigasi utama"
        items={shown}
        activeKey={overflowActive ? null : activeKey}
        variant="nav"
        className="min-w-0"
      />

      {overflow.length > 0 && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            data-menu-lainnya
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`${TAB_CLS} gap-1 ${overflowActive ? "bg-pill text-white" : "glass text-muted hover:text-ink"}`}
          >
            {MORE_LABEL}
            <Icon name="chevronDown" size={14} />
          </button>
          {open && (
            <div
              role="menu"
              aria-label="Menu lainnya"
              className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-white bg-white p-1 shadow-glass"
            >
              {overflow.map((it) => {
                const active = it.key === activeKey;
                return (
                  <Link
                    key={it.key}
                    href={it.href ?? it.key}
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold ${
                      active ? "bg-pill text-white" : "text-muted hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
