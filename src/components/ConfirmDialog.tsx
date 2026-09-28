"use client";

import { useState } from "react";

export type ConfirmDialogProps = {
  title: string;
  message: string;
  /** Pesan tambahan yang lebih tegas (mis. data sudah Cair/Cair Final) — ditampilkan dengan aksen merah. */
  strongWarning?: string;
  /** Kalau true, admin wajib isi alasan sebelum tombol konfirmasi aktif. */
  requireReason?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  strongWarning,
  requireReason = false,
  confirmLabel = "Ya, Hapus",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="mt-2 text-sm text-gray-600">{message}</p>

        {strongWarning && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {strongWarning}
          </div>
        )}

        {requireReason && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Alasan <span className="text-rose-600">*wajib diisi</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Contoh: salah input qty saat upload, koreksi sesuai invoice asli..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost" disabled={busy}>
            Batal
          </button>
          <button
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
            disabled={busy || !canConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
