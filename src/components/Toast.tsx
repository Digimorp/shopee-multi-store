"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";

export type ToastMessage = { title: string; detail?: string; tone?: "success" | "error" };

/** Notifikasi singkat pojok kanan bawah; hilang sendiri setelah `durationMs`. */
export default function Toast({
  toast,
  onClose,
  durationMs = 6000,
}: {
  toast: ToastMessage | null;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [toast, onClose, durationMs]);

  if (!toast) return null;
  const error = toast.tone === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card-lg"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
          error ? "bg-danger-bg text-danger-text" : "bg-success-bg text-success-text"
        }`}
      >
        <Icon name={error ? "x" : "check"} size={16} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800">{toast.title}</p>
        {toast.detail && <p className="mt-0.5 text-xs text-gray-500">{toast.detail}</p>}
      </div>
      <button onClick={onClose} aria-label="Tutup notifikasi" className="text-gray-300 hover:text-gray-500">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
