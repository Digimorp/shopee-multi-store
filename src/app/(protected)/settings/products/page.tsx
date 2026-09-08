"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { formatRupiah, formatDate } from "@/lib/format";

export default function SettingsProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({ sku: "", name: "", hpp: "", catalogPrice: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [err, setErr] = useState("");

  function loadProducts() {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/products/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.logs ?? []));
  }
  useEffect(loadProducts, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: form.sku,
        name: form.name,
        hpp: parseFloat(form.hpp),
        catalogPrice: parseFloat(form.catalogPrice),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Gagal menyimpan produk.");
      return;
    }
    setForm({ sku: "", name: "", hpp: "", catalogPrice: "" });
    loadProducts();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImportMsg("");
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch("/api/products/import", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportMsg(data.error ?? "Import gagal.");
      return;
    }
    setImportMsg(`Berhasil impor ${data.success} produk, ${data.failed} gagal.`);
    loadProducts();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Master Produk & HPP</h1>
      <p className="text-sm text-gray-500">
        Master SKU <strong>global</strong> — 1 SKU = 1 HPP (Modal) + 1 Harga Katalog Agen (sebelum diskon 50%),
        berlaku untuk semua toko. Hanya Owner yang bisa mengubah.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-2 card p-5 sm:grid-cols-5">
        <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input required placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2" />
        <input required type="number" placeholder="HPP" value={form.hpp} onChange={(e) => setForm({ ...form, hpp: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <input required type="number" placeholder="Harga Katalog" value={form.catalogPrice} onChange={(e) => setForm({ ...form, catalogPrice: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <button type="submit" className="sm:col-span-5 btn-primary">
          Simpan Produk
        </button>
        {err && <span className="sm:col-span-5 text-sm text-rose-600">{err}</span>}
      </form>

      <form onSubmit={handleImport} className="flex flex-wrap items-center gap-2 card p-5">
        <span className="text-sm text-gray-600">Import Master SKU via Excel (kolom: SKU, Nama Produk, HPP, Harga Katalog):</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <button type="submit" className="btn-ghost">
          Import
        </button>
        {importMsg && <span className="text-sm text-emerald-700">{importMsg}</span>}
      </form>

      <DataTable
        rowKey={(r: any) => r.id}
        rows={products}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Nama Produk", render: (r) => r.name },
          { header: "HPP", render: (r) => formatRupiah(r.hpp) },
          { header: "Harga Katalog", render: (r) => formatRupiah(r.catalogPrice) },
          { header: "Harga Agen (50%)", render: (r) => formatRupiah(r.catalogPrice * 0.5) },
        ]}
      />

      <div>
        <h2 className="mb-1 mt-2 text-sm font-semibold text-gray-800">Riwayat Perubahan HPP / Harga Katalog</h2>
        <p className="mb-2 text-xs text-gray-400">
          Dicatat otomatis tiap HPP atau Harga Katalog sebuah SKU berubah (manual maupun import).
        </p>
        <DataTable
          rowKey={(r: any) => r.id}
          rows={history}
          emptyText="Belum ada perubahan HPP tercatat."
          columns={[
            { header: "Waktu", render: (r) => formatDate(r.createdAt) },
            { header: "SKU", render: (r) => r.sku },
            { header: "Produk", render: (r) => r.name },
            {
              header: "HPP",
              render: (r) =>
                r.oldHpp === r.newHpp ? (
                  <span className="text-gray-400">{formatRupiah(r.newHpp)}</span>
                ) : (
                  <span>
                    <span className="text-gray-400 line-through">{formatRupiah(r.oldHpp)}</span>{" "}
                    <span className="font-semibold text-brand-600">→ {formatRupiah(r.newHpp)}</span>
                  </span>
                ),
            },
            {
              header: "Harga Katalog",
              render: (r) =>
                r.oldCatalog === r.newCatalog ? (
                  <span className="text-gray-400">{formatRupiah(r.newCatalog)}</span>
                ) : (
                  <span>
                    <span className="text-gray-400 line-through">{formatRupiah(r.oldCatalog)}</span>{" "}
                    <span className="font-semibold text-brand-600">→ {formatRupiah(r.newCatalog)}</span>
                  </span>
                ),
            },
            {
              header: "Sumber",
              render: (r) => (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {r.source === "import" ? "Import Excel" : "Manual"}
                </span>
              ),
            },
            { header: "Oleh", render: (r) => r.changedBy },
          ]}
        />
      </div>
    </div>
  );
}
