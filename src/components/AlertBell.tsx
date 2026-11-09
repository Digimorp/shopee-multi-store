"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

type AlertItem = { level: "warning" | "info"; title: string; detail: string };

export default function AlertBell() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/alerts?${qs}`)
        .then((r) => (r.ok ? r.json() : { items: [], count: 0 }))
        .then((d) => {
          if (!alive) return;
          setItems(d.items ?? []);
          setCount(d.count ?? 0);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [qs]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifikasi"
        className="relative grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:text-brand-500"
      >
        <Icon name="bell" size={18} />
        {/* Badge jumlah = warning (mustard); teks gelap karena putih di atas mustard hanya ~1,8:1. */}
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-neutral-900">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card-lg">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Notifikasi
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Tidak ada notifikasi.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
              {items.map((it, i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      it.level === "warning" ? "bg-warning-bg text-warning-text" : "bg-info-bg text-info-text"
                    }`}
                  >
                    <Icon name={it.level === "warning" ? "bell" : "check"} size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{it.title}</p>
                    <p className="text-[11px] leading-snug text-gray-400">{it.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
