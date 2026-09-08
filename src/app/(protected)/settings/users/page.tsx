"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import type { StoreOption } from "@/types";

type EditState = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  storeIds: string[];
  password: string;
};

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ADMIN_TOKO", storeIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
    fetch("/api/stores").then((r) => r.json()).then((d) => setStores(d.stores ?? []));
  }
  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setForm({ name: "", email: "", password: "", role: "ADMIN_TOKO", storeIds: [] });
    load();
  }

  async function toggleActive(u: any) {
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, name: u.name, role: u.role, isActive: !u.isActive }),
    });
    load();
  }

  function openEdit(u: any) {
    setEdit({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      storeIds: (u.stores ?? []).map((s: any) => s.id),
      password: "",
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setEditSaving(true);
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: edit.id,
        name: edit.name,
        role: edit.role,
        isActive: edit.isActive,
        storeIds: edit.role === "ADMIN_TOKO" ? edit.storeIds : [],
        ...(edit.password ? { password: edit.password } : {}),
      }),
    });
    setEditSaving(false);
    setEdit(null);
    load();
  }

  const toggleStore = (list: string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">User Management</h1>
      <p className="text-sm text-gray-500">
        Owner menambah Admin Toko dan mengatur pembagian toko. Klik <strong>Edit</strong> di tabel untuk mengubah nama,
        role, assignment toko, atau reset password admin yang sudah ada.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3 card p-5 sm:grid-cols-2">
        <input required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input required placeholder="Email / username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="ADMIN_TOKO">Admin Toko</option>
          <option value="OWNER">Owner / Super Admin</option>
        </select>

        {form.role === "ADMIN_TOKO" && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Mapping Toko</label>
            <div className="flex flex-wrap gap-2">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={form.storeIds.includes(s.id)}
                    onChange={(e) => setForm({ ...form, storeIds: toggleStore(form.storeIds, s.id, e.target.checked) })}
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={saving} className="sm:col-span-2 btn-primary disabled:opacity-50">
          {saving ? "Menyimpan..." : "Tambah User"}
        </button>
      </form>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={users}
        columns={[
          { header: "Nama", render: (r) => r.name },
          { header: "Email", render: (r) => r.email },
          { header: "Role", render: (r) => (r.role === "OWNER" ? "Owner" : "Admin Toko") },
          {
            header: "Toko",
            render: (r) =>
              r.role === "OWNER" ? (
                <span className="text-gray-400">semua</span>
              ) : (
                r.stores.map((s: any) => s.code).join(", ") || <span className="text-amber-600">belum ada</span>
              ),
          },
          { header: "Status", render: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
          {
            header: "Aksi",
            render: (r) => (
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => toggleActive(r)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                  {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ),
          },
        ]}
      />

      {edit && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 p-4" onMouseDown={() => setEdit(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800">Edit user — {edit.email}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Nama"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <select
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="ADMIN_TOKO">Admin Toko</option>
                <option value="OWNER">Owner / Super Admin</option>
              </select>
              <input
                type="password"
                placeholder="Password baru (kosongkan = tidak diubah)"
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>

            {edit.role === "ADMIN_TOKO" && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Assignment Toko ({edit.storeIds.length})</label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      onClick={() => setEdit({ ...edit, storeIds: stores.map((s) => s.id) })}
                      className="text-brand-600 hover:underline"
                    >
                      pilih semua
                    </button>
                    <button onClick={() => setEdit({ ...edit, storeIds: [] })} className="text-gray-500 hover:underline">
                      kosongkan
                    </button>
                  </div>
                </div>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={edit.storeIds.includes(s.id)}
                        onChange={(e) => setEdit({ ...edit, storeIds: toggleStore(edit.storeIds, s.id, e.target.checked) })}
                      />
                      {s.code}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn-ghost">
                Batal
              </button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-primary disabled:opacity-50">
                {editSaving ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
