"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { getDefaultPeriod } from "@/lib/period";
import { Icon } from "@/components/icons";
import type { StoreOption } from "@/types";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const def = getDefaultPeriod();

  const storeId = searchParams.get("storeId") ?? "all";
  const from = searchParams.get("from") ?? toInputDate(def.from);
  const to = searchParams.get("to") ?? toInputDate(def.to);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores ?? []));
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (!params.get("from")) params.set("from", from);
    if (!params.get("to")) params.set("to", to);
    if (!params.get("storeId")) params.set("storeId", storeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const role = (session?.user as any)?.role;
  const name = session?.user?.name ?? "";
  const initials = name
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fieldClass =
    "rounded-xl border border-gray-200 bg-canvas px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-400";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={storeId} onChange={(e) => updateParam("storeId", e.target.value)} className={fieldClass}>
          {role === "OWNER" && <option value="all">Semua Toko (14)</option>}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => updateParam("from", e.target.value)} className={fieldClass} />
        <span className="text-sm text-gray-300">s/d</span>
        <input type="date" value={to} onChange={(e) => updateParam("to", e.target.value)} className={fieldClass} />
      </div>

      <div className="flex items-center gap-2">
        <button className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-brand-500">
          <Icon name="search" size={18} />
        </button>
        <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-brand-500">
          <Icon name="bell" size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
            {initials || "U"}
          </span>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-semibold text-gray-800">{name}</div>
            <div className="text-[11px] text-gray-400">{role === "OWNER" ? "Owner" : "Admin Toko"}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Keluar"
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-brand-300 hover:text-brand-500"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
