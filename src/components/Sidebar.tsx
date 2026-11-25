"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/icons";
import { menuForRole, hrefWithFilter, isNavActive } from "@/components/navConfig";

/**
 * T-013 batch 18 (Kaca Lembut): rel kiri = kapsul hitam vertikal yang melayang (jarak 12px dari tepi,
 * di tengah tinggi layar). Isi = menu yang sama dengan pil atas (navConfig). Ikon putih; item aktif =
 * lingkaran kuning. Tiap ikon punya aria-label + tooltip nama menu (hover & fokus keyboard).
 * Di bawah 820px rel disembunyikan: menu cukup lewat pil atas yang bisa digeser horizontal.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  // Menu Owner (Pengaturan) baru tampil setelah sesi diketahui -- cegah flash untuk Admin Toko.
  const items = menuForRole(status !== "loading" ? role : undefined);

  return (
    <aside
      aria-label="Rel menu"
      className="fixed left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-sidebar px-2 py-3 shadow-glass min-[820px]:block"
    >
      <nav aria-label="Menu utama (rel)" className="flex flex-col items-center gap-2">
        {items.map((m) => {
          const active = isNavActive(pathname, m.href);
          return (
            <Link
              key={m.href}
              href={hrefWithFilter(m.href, searchParams)}
              aria-label={m.label}
              aria-current={active ? "page" : undefined}
              className={`group relative grid h-11 w-11 place-items-center rounded-full transition ${
                active
                  ? "bg-sidebar-active text-sidebar-activeText"
                  : "text-sidebar-text hover:bg-sidebar-hover"
              }`}
            >
              <Icon name={m.icon} size={20} />
              {/* Tooltip nama menu: muncul saat hover / fokus keyboard. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-glass transition group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {m.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
