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
        aria-label={count > 0 ? `Notifikasi (${count})` : "Notifikasi"}
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-full border border-white bg-white/70 text-ink transition hover:bg-white"
      >
        <Icon name="bell" size={18} />
        {/* Badge jumlah = warning (mustard); teks gelap karena putih di atas mustard hanya ~1,8:1. */}
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-xs font-bold text-ink">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white bg-white shadow-glass">
          <div className="border-b border-ink/5 px-4 py-2.5 text-xs font-semibold text-muted">
            Notifikasi
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Tidak ada notifikasi.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-ink/5 overflow-y-auto">
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
                    <p className="text-sm font-medium text-ink">{it.title}</p>
                    <p className="text-xs leading-snug text-muted">{it.detail}</p>
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
