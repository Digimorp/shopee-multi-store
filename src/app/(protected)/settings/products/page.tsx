"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { formatRupiah } from "@/lib/format";
import type { StoreOption } from "@/types";

export default function SettingsProductsPage() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ sku: "", name: "", hpp: "", catalogPrice: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    fetch("/api/stores").then((r) => r.json()).then((d) => {
      setStores(d.stores ?? []);
      if (d.stores?.[0]) setStoreId(d.stores[0].id);
    });
  }, []);

  function loadProducts(sid: string) {
    if (!sid) return;
    fetch(`/api/products?storeId=${sid}`).then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }
  useEffect(() => loadProducts(storeId), [storeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, sku: form.sku, name: form.name, hpp: parseFloat(form.hpp), catalogPrice: parseFloat(form.catalogPrice) }),
    });
    setForm({ sku: "", name: "", hpp: "", catalogPrice: "" });
    loadProducts(storeId);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !storeId) return;
    const fd = new FormData();
    fd.append("file", importFile);
    fd.append("storeId", storeId);
    const res = await fetch("/api/products/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportMsg(`Berhasil impor ${data.success} produk, ${data.failed} gagal.`);
    loadProducts(storeId);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Master Produk & HPP</h1>
      <p className="text-sm text-gray-500">Input SKU, Nama Produk, HPP (Modal), dan Harga Katalog Agen (sebelum diskon 50%) per toko.</p>

      <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} - {s.name}
          </option>
        ))}
      </select>

      <form onSubmit={handleSubmit} className="grid gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-5">
        <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input required placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2" />
        <input required type="number" placeholder="HPP" value={form.hpp} onChange={(e) => setForm({ ...form, hpp: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input required type="number" placeholder="Harga Katalog" value={form.catalogPrice} onChange={(e) => setForm({ ...form, catalogPrice: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" className="sm:col-span-5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          Simpan Produk
        </button>
      </form>

      <form onSubmit={handleImport} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <span className="text-sm text-gray-600">Import Master SKU via Excel (kolom: SKU, Nama Produk, HPP, Harga Katalog):</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Import
        </button>
        {importMsg && <span className="text-sm text-green-700">{importMsg}</span>}
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
    </div>
  );
}
