"use client";

import { useState } from "react";

const STATUS_OPTIONS = ["CANCEL", "RETUR", "TRANSIT", "PENDING_SETTLEMENT", "SELESAI"] as const;

export type OrderEditRow = {
  id: string;
  orderSn: string;
  productName: string;
  qty: number;
  status: string;
  grossOmzet: number;
  netSettlement: number;
};

export default function OrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: OrderEditRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    productName: order.productName,
    qty: String(order.qty),
    status: order.status,
    grossOmzet: String(order.grossOmzet),
    netSettlement: String(order.netSettlement),
    reason: "",
  });
  const [error, setError] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: form.productName,
        qty: Number(form.qty),
        status: form.status,
        grossOmzet: Number(form.grossOmzet),
        netSettlement: Number(form.netSettlement),
        reason: form.reason.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Gagal menyimpan perubahan.");
      if (d.locked) setNeedsReason(true);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-lg" onMouseDown={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-gray-800">Edit Pesanan — {order.orderSn}</p>
        <p className="mt-0.5 text-xs text-gray-400">No. Pesanan tidak bisa diubah (kunci pencocokan Rekonsiliasi).</p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Nama Produk"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="number"
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Omzet Bruto"
            value={form.grossOmzet}
            onChange={(e) => setForm({ ...form, grossOmzet: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Uang Cair (netSettlement)"
            value={form.netSettlement}
            onChange={(e) => setForm({ ...form, netSettlement: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Alasan Perubahan {needsReason && <span className="text-rose-600">*wajib diisi (order sudah direkonsiliasi)</span>}
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={2}
            placeholder="Opsional — wajib kalau order sudah berstatus Cair/Cair Final"
            className={`w-full rounded-xl border px-3 py-2 text-sm ${needsReason ? "border-rose-300" : "border-gray-200"}`}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost" disabled={saving}>
            Batal
          </button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
