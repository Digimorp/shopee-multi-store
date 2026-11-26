"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import AiAnomalyPanel from "@/components/AiAnomalyPanel";
import { useStores } from "@/components/StoreChips";
import { formatRupiah, formatDate } from "@/lib/format";

// T-013 batch 21: Produk & HPP MILIK TIAP TOKO. Pilih toko dulu (otomatis bila 1 toko, chip bila lebih),
// lalu tambah / ubah / hapus / import / salin dari toko lain untuk toko itu. Owner juga melihat "Semua toko"
// dan produk lama global dengan label "Warisan (global)". Akses tetap dicek di server (src/lib/productAccess.ts).
const ALL = "all";
const LEGACY = "legacy";
const EMPTY_STORE = "Belum ada produk untuk toko ini. Import file Master SKU atau salin dari toko lain.";

type Role = "OWNER" | "ADMIN_TOKO";

export default function SettingsProductsPage({ role = "OWNER" }: { role?: Role }) {
  const isOwner = role === "OWNER";
  const stores = useStores();
  const [sel, setSel] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listErr, setListErr] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({ sku: "", name: "", hpp: "", catalogPrice: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [copyErr, setCopyErr] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", hpp: "", catalogPrice: "" });
  const [editErr, setEditErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Pilihan awal: toko pertama (Owner tanpa toko -> Semua).
  useEffect(() => {
    if (stores && sel == null) setSel(stores[0]?.id ?? (isOwner ? ALL : null));
  }, [stores, sel, isOwner]);

  const isStore = !!sel && sel !== ALL && sel !== LEGACY;
  const storeName = (id: string | null) => stores?.find((s) => s.id === id)?.name ?? "";

  const loadProducts = useCallback(() => {
    if (!sel) return;
    setLoadingList(true);
    setListErr("");
    const q = `storeId=${encodeURIComponent(sel)}`;
    fetch(`/api/products?${q}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Gagal memuat produk.");
        setProducts(d.products ?? []);
      })
      .catch((e) => {
        setProducts([]);
        setListErr(e.message);
      })
      .finally(() => setLoadingList(false));
    fetch(`/api/products/history?${q}`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setHistory(d.logs ?? []));
  }, [sel]);
  useEffect(loadProducts, [loadProducts]);

  function pick(id: string) {
    setSel(id);
    setErr("");
    setImportMsg("");
    setImportErr("");
    setImportResult(null);
    setCopyOpen(false);
    setCopyMsg("");
    setCopyErr("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStore) return;
    setErr("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: sel,
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

  function openEdit(p: any) {
    setEditing(p);
    setEditForm({ name: p.name, hpp: String(p.hpp), catalogPrice: String(p.catalogPrice) });
    setEditErr("");
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setEditErr("");
    const res = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: editForm.name,
        hpp: parseFloat(editForm.hpp),
        catalogPrice: parseFloat(editForm.catalogPrice),
      }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setEditErr(d.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setEditing(null);
    loadProducts();
  }

  async function confirmDeleteProduct() {
    if (!deleting) return;
    setDeleteBusy(true);
    await fetch(`/api/products?id=${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    setDeleting(null);
    loadProducts();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !isStore) return;
    setImportMsg("");
    setImportErr("");
    setImportResult(null);
    const fd = new FormData();
    fd.append("storeId", sel!);
    fd.append("file", importFile);
    const res = await fetch("/api/products/import", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportErr(data.error ?? "Import gagal.");
      return;
    }
    setImportMsg(
      `Import ke ${storeName(sel)}: ${data.created} baru, ${data.updated} diperbarui, ${data.skipped} dilewati (sama), ${data.failed} error.`
    );
    setImportResult(data);
    loadProducts();
  }

  // Sumber salin: toko lain yang boleh diakses (+ produk warisan untuk Owner).
  const copySources = [
    ...(stores ?? []).filter((s) => s.id !== sel).map((s) => ({ id: s.id, label: s.name })),
    ...(isOwner ? [{ id: LEGACY, label: "Warisan (global)" }] : []),
  ];

  async function handleCopy() {
    if (!isStore || !copyFrom) return;
    setCopyBusy(true);
    setCopyMsg("");
    setCopyErr("");
    const res = await fetch("/api/products/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromStoreId: copyFrom, toStoreId: sel }),
    });
    const d = await res.json().catch(() => ({}));
    setCopyBusy(false);
    if (!res.ok) {
      setCopyErr(d.error ?? "Gagal menyalin produk.");
      return;
    }
    setCopyMsg(`${d.copied} produk disalin, ${d.skipped} dilewati (SKU sudah ada di toko ini).`);
    loadProducts();
  }

  if (stores == null) return <p className="text-sm text-muted">Memuat…</p>;

  if (!isOwner && stores.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink">Produk & HPP</h2>
        <div className="card p-6 text-sm text-ink">Akun ini belum dihubungkan ke toko. Hubungi Owner.</div>
      </div>
    );
  }

  const chips = [
    ...stores.map((s) => ({ id: s.id, label: s.name })),
    ...(isOwner ? [{ id: ALL, label: "Semua toko" }, { id: LEGACY, label: "Warisan (global)" }] : []),
  ];
  const showStoreCol = !isStore;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">Produk & HPP</h2>
      <p className="text-sm text-muted">
        Daftar produk <strong>milik tiap toko</strong> — 1 SKU per toko = 1 HPP (Modal) + 1 Harga Katalog Agen (sebelum
        diskon 50%). HPP satu toko tidak mengubah profit toko lain.
      </p>

      {chips.length > 1 ? (
        <div role="group" aria-label="Pilih toko" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              aria-pressed={sel === c.id}
              className={`chip shrink-0 whitespace-nowrap ${sel === c.id ? "chip-active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink">
          Toko: <strong>{stores[0]?.name}</strong>
        </p>
      )}

      {isStore ? (
        <>
          <form onSubmit={handleSubmit} className="grid gap-2 card p-6 sm:grid-cols-5">
            <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input required placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:col-span-2" />
            <input required type="number" placeholder="HPP" value={form.hpp} onChange={(e) => setForm({ ...form, hpp: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input required type="number" placeholder="Harga Katalog" value={form.catalogPrice} onChange={(e) => setForm({ ...form, catalogPrice: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <button type="submit" className="sm:col-span-5 btn-primary">
              Simpan Produk ke {storeName(sel)}
            </button>
            {err && <span className="sm:col-span-5 text-sm text-danger-text">{err}</span>}
          </form>

          <form onSubmit={handleImport} className="flex flex-wrap items-center gap-2 card p-6">
            <span className="text-sm text-gray-600">
              Import Master SKU ke <strong className="text-ink">{storeName(sel)}</strong> via Excel (kolom: SKU, Nama Produk, HPP, Harga Katalog):
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="min-w-0 max-w-full text-sm" />
            <button type="submit" className="btn-ghost">
              Import
            </button>
            {importMsg && <span className="w-full text-sm text-success-text">{importMsg}</span>}
            {importErr && <span className="w-full text-sm text-danger-text">{importErr}</span>}
            {importResult?.errors?.length > 0 && (
              <ul className="w-full list-disc pl-5 text-xs text-danger-text">
                {importResult.errors.slice(0, 5).map((m: string) => (
                  <li key={m}>{m}</li>
                ))}
                {importResult.errors.length > 5 && <li>… dan {importResult.errors.length - 5} baris lain.</li>}
              </ul>
            )}
          </form>

          <div className="card space-y-3 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Salin produk (SKU, nama, HPP, harga katalog) dari toko lain ke {storeName(sel)}.</span>
              {copySources.length > 0 ? (
                <button type="button" className="btn-ghost" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}>
                  Salin dari toko lain
                </button>
              ) : (
                <span className="text-sm text-muted">Tidak ada toko lain yang bisa disalin.</span>
              )}
            </div>
            {copyOpen && (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="copy-from" className="text-sm text-ink">
                  Dari
                </label>
                <select
                  id="copy-from"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  className="min-h-11 min-w-0 max-w-full rounded-full border border-gray-200 bg-white px-4 text-sm"
                >
                  <option value="">Pilih toko asal…</option>
                  {copySources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-primary disabled:opacity-50" disabled={!copyFrom || copyBusy} onClick={handleCopy}>
                  {copyBusy ? "Menyalin…" : "Salin"}
                </button>
                <span className="w-full text-xs text-muted">SKU yang sudah ada di {storeName(sel)} dilewati, tidak ditimpa.</span>
              </div>
            )}
            {copyMsg && <p className="text-sm text-success-text">{copyMsg}</p>}
            {copyErr && <p className="text-sm text-danger-text">{copyErr}</p>}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Pilih satu toko untuk menambah, import, atau menyalin produk.</p>
      )}

      {importResult && (
        <AiAnomalyPanel
          anomalies={importResult.aiAnomalies ?? []}
          summary={importResult.aiSummary}
          aiCheckSkipped={importResult.aiCheckSkipped}
        />
      )}

      {listErr && <p className="text-sm text-danger-text">{listErr}</p>}

      <DataTable
        rowKey={(r: any) => r.id}
        rows={products}
        emptyText={loadingList ? "Memuat…" : isStore ? EMPTY_STORE : "Belum ada produk."}
        columns={[
          { header: "SKU", render: (r) => r.sku },
          { header: "Nama Produk", render: (r) => <span className="cell-wrap">{r.name}</span> },
          ...(showStoreCol
            ? [
                {
                  header: "Toko",
                  render: (r: any) =>
                    r.legacy ? (
                      <span className="whitespace-nowrap rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-text">Warisan (global)</span>
                    ) : (
                      <span className="cell-wrap">{r.store?.name ?? storeName(r.storeId)}</span>
                    ),
                },
              ]
            : []),
          { header: "HPP", render: (r) => formatRupiah(r.hpp) },
          { header: "Harga Katalog", render: (r) => formatRupiah(r.catalogPrice) },
          { header: "Harga Agen (50%)", render: (r) => formatRupiah(r.catalogPrice * 0.5) },
          { header: "Status", render: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
          {
            header: "Aksi",
            render: (r) => (
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(r)} className="btn-chip">
                  Edit
                </button>
                {r.isActive && (
                  <button onClick={() => setDeleting(r)} className="btn-chip btn-chip-danger">
                    Hapus
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-ink">
              Edit Produk — {editing.sku}
              {editing.legacy ? " (Warisan global)" : editing.store?.name ? ` · ${editing.store.name}` : ""}
            </p>
            {editErr && <p className="mt-2 text-sm text-danger-text">{editErr}</p>}
            <div className="mt-3 grid gap-3">
              <input
                placeholder="Nama Produk"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="HPP"
                value={editForm.hpp}
                onChange={(e) => setEditForm({ ...editForm, hpp: e.target.value })}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Harga Katalog"
                value={editForm.catalogPrice}
                onChange={(e) => setEditForm({ ...editForm, catalogPrice: e.target.value })}
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
          title={`Hapus produk ${deleting.sku}?`}
          message={`Yakin hapus produk "${deleting.name}"? Aksi ini bisa dibatalkan lewat log admin (produk disembunyikan dari master, bukan dihapus permanen).`}
          busy={deleteBusy}
          onConfirm={confirmDeleteProduct}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div>
        <h2 className="mb-1 mt-2 text-sm font-semibold text-ink">Riwayat Perubahan HPP / Harga Katalog</h2>
        <p className="mb-2 text-xs text-muted">
          Dicatat otomatis tiap HPP atau Harga Katalog sebuah SKU berubah (manual maupun import), beserta siapa yang mengubah.
        </p>
        <DataTable
          rowKey={(r: any) => r.id}
          rows={history}
          emptyText="Belum ada perubahan HPP tercatat."
          columns={[
            { header: "Waktu", render: (r) => formatDate(r.createdAt) },
            { header: "SKU", render: (r) => r.sku },
            { header: "Produk", render: (r) => <span className="cell-wrap">{r.name}</span> },
            {
              header: "HPP",
              render: (r) =>
                r.oldHpp === r.newHpp ? (
                  <span className="text-muted">{formatRupiah(r.newHpp)}</span>
                ) : (
                  <span>
                    <span className="text-muted line-through">{formatRupiah(r.oldHpp)}</span>{" "}
                    <span className="font-semibold text-brand-600">→ {formatRupiah(r.newHpp)}</span>
                  </span>
                ),
            },
            {
              header: "Harga Katalog",
              render: (r) =>
                r.oldCatalog === r.newCatalog ? (
                  <span className="text-muted">{formatRupiah(r.newCatalog)}</span>
                ) : (
                  <span>
                    <span className="text-muted line-through">{formatRupiah(r.oldCatalog)}</span>{" "}
                    <span className="font-semibold text-brand-600">→ {formatRupiah(r.newCatalog)}</span>
                  </span>
                ),
            },
            {
              header: "Sumber",
              render: (r) => (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
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
