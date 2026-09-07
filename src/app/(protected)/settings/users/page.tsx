"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import type { StoreOption } from "@/types";

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ADMIN_TOKO", storeIds: [] as string[] });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">User Management</h1>
      <p className="text-sm text-gray-500">Tambah Admin Toko dan mapping toko yang dikuasakan (total 4 Admin Toko untuk 14 toko).</p>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <input required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
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
                    onChange={(e) => {
                      const next = e.target.checked ? [...form.storeIds, s.id] : form.storeIds.filter((id) => id !== s.id);
                      setForm({ ...form, storeIds: next });
                    }}
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
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
          { header: "Toko", render: (r) => r.stores.map((s: any) => s.code).join(", ") || "-" },
          { header: "Status", render: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
          {
            header: "Aksi",
            render: (r) => (
              <button onClick={() => toggleActive(r)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                {r.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
