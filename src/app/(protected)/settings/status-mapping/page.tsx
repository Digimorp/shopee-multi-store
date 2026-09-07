"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";

const CATEGORIES = ["CANCEL", "RETUR", "TRANSIT", "PENDING_SETTLEMENT", "SELESAI"] as const;

export default function StatusMappingPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [form, setForm] = useState({ pattern: "", category: "SELESAI", priority: "50", note: "" });
  const [err, setErr] = useState("");

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

  async function remove(id: string) {
    await fetch(`/api/status-mappings?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Mapping Status Pesanan</h1>
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

      <form onSubmit={handleSubmit} className="grid gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-6">
        <input
          required
          placeholder="Pattern (mis. dibatalkan)"
          value={form.pattern}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Catatan (opsional)"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
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
            render: (r) => (
              <button
                onClick={() => remove(r.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Hapus
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
