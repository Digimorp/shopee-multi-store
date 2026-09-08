"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";

export default function SettingsStoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [form, setForm] = useState({ code: "", name: "" });

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Master Data Toko</h1>
      <p className="text-sm text-gray-500">Kelola daftar 14 toko Shopee yang dikelola perusahaan.</p>

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
        columns={[
          { header: "Kode", render: (r) => r.code },
          { header: "Nama Toko", render: (r) => r.name },
          { header: "Status", render: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
          {
            header: "Aksi",
            render: (r) => (
              <button onClick={() => toggleActive(r)} className="btn-chip">
                {r.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
