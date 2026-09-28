"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";

const CATEGORIES = ["CANCEL", "RETUR", "TRANSIT", "PENDING_SETTLEMENT", "SELESAI"] as const;

export default function StatusMappingPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [form, setForm] = useState({ pattern: "", category: "SELESAI", priority: "50", note: "" });
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ category: "SELESAI", priority: "50", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function load() {
    fetch("/api/status-mappings")
      .then((r) => r.json())
      .then((d) => setMappings(d.mappings ?? []));
  }
  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/status-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: form.pattern,
        category: form.category,
        priority: parseInt(form.priority) || 100,
        note: form.note || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Gagal menyimpan.");
      return;
    }
    setForm({ pattern: "", category: "SELESAI", priority: "50", note: "" });
    load();
  }

  function openEdit(m: any) {
    setEditing(m);
    setEditForm({ category: m.category, priority: String(m.priority), note: m.note ?? "" });
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    await fetch("/api/status-mappings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        category: editForm.category,
        priority: parseInt(editForm.priority) || 100,
        note: editForm.note || null,
      }),
    });
    setEditSaving(false);
    setEditing(null);
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    await fetch(`/api/status-mappings?id=${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    setDeleting(null);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mapping Status Pesanan</h1>
      <p className="text-sm text-gray-500">
        Aturan penerjemahan teks <strong>&quot;Status Pesanan&quot;</strong> dari file Shopee ke 5 kategori internal.
        Pattern dicocokkan sebagai <em>potongan kata</em> (tidak case-sensitive). Kalau beberapa pattern cocok untuk
        satu status, <strong>priority terkecil</strong> yang dipakai. Kalau tabel ini kosong, sistem pakai aturan
        bawaan di <code>src/lib/classification.ts</code>.
      </p>
      <p className="text-xs text-gray-500">
        Catatan: pembedaan <strong>Selesai (Cair)</strong> vs <strong>Belum Cair</strong> tidak diatur di sini —
        ditentukan otomatis dari ada/tidaknya kolom &quot;Waktu Dana Dilepaskan&quot;.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-2 card p-5 sm:grid-cols-6">
        <input
          required
          placeholder="Pattern (mis. dibatalkan)"
          value={form.pattern}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Priority"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Catatan (opsional)"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-primary">
          Simpan
        </button>
        {err && <span className="sm:col-span-6 text-sm text-red-600">{err}</span>}
      </form>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={mappings}
        emptyText="Belum ada aturan custom — sistem memakai aturan bawaan."
        columns={[
          { header: "Pattern", render: (r) => <code className="text-xs">{r.pattern}</code> },
          { header: "Kategori", render: (r) => <StatusBadge status={r.category} /> },
          { header: "Priority", render: (r) => r.priority },
          { header: "Catatan", render: (r) => r.note ?? "-" },
          { header: "Aktif", render: (r) => (r.isActive ? "Ya" : "Tidak") },
          {
            header: "Aksi",
            render: (r) =>
              r.isActive ? (
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(r)} className="btn-chip">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(r)} className="btn-chip btn-chip-danger">
                    Hapus
                  </button>
                </div>
              ) : (
                <span className="text-gray-300">—</span>
              ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800">
              Edit Mapping — <code className="text-xs">{editing.pattern}</code>
            </p>
            <div className="mt-3 grid gap-3">
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Priority"
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Catatan (opsional)"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn-ghost" disabled={editSaving}>
                Batal
              </button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-primary disabled:opacity-50">
                {editSaving ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Hapus mapping "${deleting.pattern}"?`}
          message="Aksi ini bisa dibatalkan lewat log admin (mapping disembunyikan, bukan dihapus permanen dari database)."
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
