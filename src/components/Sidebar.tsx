"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/icons";
import { useSidebar } from "@/components/SidebarContext";
import { MENU, SETTINGS_MENU, isNavActive } from "@/components/navConfig";

// Label pemisah grup — hanya tampil di drawer layar sempit. Di rail desktop diganti garis tipis.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-7 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted lg:hidden">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  // Jangan render menu Pengaturan (owner-only) sebelum sesi diketahui — cegah flash.
  const sessionReady = status !== "loading";
  const { open, setOpen } = useSidebar();
  const close = () => setOpen(false);

  // Tutup drawer tiap pindah halaman (termasuk tombol back/forward browser).
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);

  // >= lg: kotak ikon 44px di tengah rail. < lg (drawer): baris penuh ikon + label.
  const itemClass = (href: string) =>
    `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition lg:mx-auto lg:h-11 lg:w-11 lg:justify-center lg:px-0 lg:py-0 ${
      isNavActive(pathname, href)
        ? "bg-sidebar-active text-sidebar-activeText"
        : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
    }`;

  return (
    <>
      {/* Backdrop drawer — hanya di layar sempit (< lg). Klik = tutup. */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* < lg: off-canvas drawer 230px berlabel, full-height biasa (TIDAK ikut capsule).
          >= lg: capsule ikon 64px yang mengambang — margin seragam 12px dari tepi layar (atas/bawah/kiri),
          rounded-full, shadow-2xl tetap dipakai. Margin kiri 12px masih di dalam gutter rail 64px + padding
          konten 24px, jadi lebar area konten TIDAK berkurang (tabel lebar tidak jadi terpotong).
          overflow-hidden supaya item yang di-scroll terpotong mengikuti lengkung capsule. */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[230px] max-w-[85vw] flex-col bg-sidebar shadow-2xl transition-[transform,visibility] duration-300 ease-out lg:visible lg:inset-y-3 lg:left-3 lg:z-30 lg:w-16 lg:translate-x-0 lg:overflow-hidden lg:rounded-full ${
          // invisible saat tertutup: link di drawer tidak bisa kena Tab/screen reader.
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-950">
            <Icon name="store" size={18} strokeWidth={2} />
          </span>
          <span className="flex-1 text-[15px] font-bold leading-tight text-white">
            Shopee
            <br />
            <span className="text-sidebar-muted">Multi-Toko</span>
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Tutup menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-white"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav aria-label="Menu utama" className="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:space-y-2 lg:px-0 lg:py-5">
          {MENU.map((m) => (
            <Link key={m.href} href={withQs(m.href)} onClick={close} title={m.label} className={itemClass(m.href)}>
              <Icon name={m.icon} size={20} className="shrink-0" />
              <span className="min-w-0 leading-snug lg:sr-only">{m.label}</span>
            </Link>
          ))}

          {!sessionReady ? (
            <div className="space-y-2 px-3 pt-6 lg:px-0">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-full bg-sidebar-hover lg:mx-auto lg:h-11 lg:w-11 lg:rounded-xl" />
              ))}
            </div>
          ) : (
            role === "OWNER" && (
              <>
                <SectionLabel>Pengaturan</SectionLabel>
                <hr className="mx-auto my-3 hidden w-6 border-sidebar-border lg:block" />
                {SETTINGS_MENU.map((m) => (
                  <Link key={m.href} href={withQs(m.href)} onClick={close} title={m.label} className={itemClass(m.href)}>
                    <Icon name={m.icon} size={20} className="shrink-0" />
                    <span className="min-w-0 leading-snug lg:sr-only">{m.label}</span>
                  </Link>
                ))}
              </>
            )
          )}
        </nav>
      </aside>
    </>
  );
}
