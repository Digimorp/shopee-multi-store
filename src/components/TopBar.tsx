"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { getDefaultPeriod } from "@/lib/period";
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
  const name = session?.user?.name;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={storeId}
          onChange={(e) => updateParam("storeId", e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {role === "OWNER" && <option value="all">Semua Toko (14)</option>}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-400">s/d</span>
        <input
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">
          {name} <span className="text-gray-400">({role === "OWNER" ? "Owner" : "Admin Toko"})</span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
