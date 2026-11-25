"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getCurrentPeriodMonth } from "@/lib/period";
import type { StoreOption } from "@/types";

// Satu kali fetch per muat halaman untuk data yang dipakai bersama (daftar toko, cut-off periode).
const cache = new Map<string, Promise<any>>();
function cachedJson(url: string): Promise<any> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .catch((e) => {
          cache.delete(url); // gagal -> boleh dicoba lagi
          throw e;
        })
    );
  }
  return cache.get(url)!;
}

/** Daftar toko yang boleh dilihat akun ini (/api/stores). null = belum dimuat. */
export function useStores(): StoreOption[] | null {
  const [stores, setStores] = useState<StoreOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    cachedJson("/api/stores")
      .then((d) => alive && setStores(d.stores ?? []))
      .catch(() => alive && setStores([]));
    return () => {
      alive = false;
    };
  }, []);
  return stores;
}

/** Hari cut-off periode (/api/periods, sumber yang sama dengan server). null = belum dimuat. */
export function useCutoffDay(): number | null {
  const [cutoff, setCutoff] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    cachedJson("/api/periods")
      .then((d) => alive && setCutoff(Number.isInteger(d.cutoffDay) ? d.cutoffDay : 25))
      .catch(() => alive && setCutoff(25)); // sama dengan default server kalau PeriodSetting kosong
    return () => {
      alive = false;
    };
  }, []);
  return cutoff;
}

/**
 * T-013 batch 18: baris chip toko (pengganti dropdown toko di TopBar). "Semua toko" / toko aktif =
 * pil hitam, toko lain = chip kaca. Banyak toko -> baris bisa digeser horizontal.
 * Nilai yang ditulis ke URL sama persis dengan dropdown lama (storeId=all | id toko), jadi data tidak berubah.
 */
export default function StoreChips() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const stores = useStores();
  const cutoffDay = useCutoffDay();
  const role = (session?.user as any)?.role as string | undefined;
  const storeId = searchParams.get("storeId") ?? "all";

  if (status === "loading" || stores == null) {
    return <div className="h-11 w-56 animate-pulse rounded-full bg-white/60" aria-hidden="true" />;
  }

  if (stores.length === 0) {
    if (role === "OWNER") {
      return (
        <p className="flex flex-wrap items-center gap-3 text-sm text-ink">
          Belum ada toko.
          <Link href="/pengaturan?tab=toko" className="btn-primary">
            Tambah toko
          </Link>
        </p>
      );
    }
    if ((session?.user as any)?.invalid) return null;
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        Akun kamu belum dihubungkan ke toko. Hubungi Owner.
      </p>
    );
  }

  // Sama dengan dropdown lama: belum ada filter periode -> tulis bulan berjalan supaya ikut terbawa antar menu.
  const hrefFor = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("storeId", id);
    if (!params.get("period") && !params.get("from") && cutoffDay != null) {
      params.set("period", getCurrentPeriodMonth(cutoffDay));
    }
    return `${pathname}?${params.toString()}`;
  };

  // "Semua toko": Owner selalu; Admin Toko hanya bila punya > 1 toko (server membatasi ke tokonya).
  const showAll = role === "OWNER" || stores.length > 1;
  const activeId = storeId === "all" && !showAll ? stores[0].id : storeId;
  const chips = [
    ...(showAll ? [{ id: "all", label: `Semua toko (${stores.length})`, title: "Semua toko" }] : []),
    ...stores.map((s) => ({ id: s.id, label: s.name, title: `${s.code} - ${s.name}` })),
  ];

  return (
    <nav aria-label="Filter toko" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {chips.map((c) => {
          const active = c.id === activeId;
          return (
            <Link
              key={c.id}
              href={hrefFor(c.id)}
              scroll={false}
              title={c.title}
              aria-current={active ? "true" : undefined}
              className={`chip ${active ? "chip-active" : ""}`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
