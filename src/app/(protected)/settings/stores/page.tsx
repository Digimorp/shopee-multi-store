"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function SettingsStoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [form, setForm] = useState({ code: "", name: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "" });
  const [editErr, setEditErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<any | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  function load() {
    fetch("/api/stores").then((r) => r.json()).then((d) => setStores(d.stores ?? []));
  }
  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ code: "", name: "" });
    load();
  }

  async function toggleActive(s: any) {
    await fetch("/api/stores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, name: s.name, code: s.code, isActive: !s.isActive }),
    });
    load();
  }

  function openEdit(s: any) {
    setEditing(s);
    setEditForm({ code: s.code, name: s.name });
    setEditErr("");
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setEditErr("");
    const res = await fetch("/api/stores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editForm.name, code: editForm.code, isActive: editing.isActive }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setEditErr(d.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setEditing(null);
    load();
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    setDeactivateBusy(true);
    await toggleActive(deactivating);
    setDeactivateBusy(false);
    setDeactivating(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Master Data Toko</h1>
      <p className="text-sm text-gray-500">Kelola daftar toko Shopee yang dikelola perusahaan.</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 card p-5">
        <input required placeholder="Kode (mis. TOKO15)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input required placeholder="Nama Toko" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <button type="submit" className="btn-primary">
          Tambah Toko
        </button>
      </form>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={stores}
        emptyText="Belum ada toko. Tambahkan toko pertama lewat form di atas."
        columns={[
          { header: "Kode", render: (r) => r.code },
          { header: "Nama Toko", render: (r) => r.name },
          { header: "Status", render: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
          {
            header: "Aksi",
            render: (r) => (
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(r)} className="btn-chip">
                  Edit
                </button>
                <button
                  onClick={() => (r.isActive ? setDeactivating(r) : toggleActive(r))}
                  className={`btn-chip ${r.isActive ? "btn-chip-danger" : ""}`}
                >
                  {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800">Edit Toko</p>
            {editErr && <p className="mt-2 text-sm text-rose-600">{editErr}</p>}
            <div className="mt-3 grid gap-3">
              <input
                placeholder="Kode"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Nama Toko"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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

      {deactivating && (
        <ConfirmDialog
          title={`Nonaktifkan toko ${deactivating.code}?`}
          message="Yakin nonaktifkan toko ini? Aksi ini bisa dibatalkan lewat log admin (toko disembunyikan dari daftar aktif, bukan dihapus permanen) — data pesanan & laporan toko ini tetap tersimpan."
          confirmLabel="Ya, Nonaktifkan"
          busy={deactivateBusy}
          onConfirm={confirmDeactivate}
          onCancel={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}
