"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { StoreOption } from "@/types";

export default function UploadForm({ stores, onDone }: { stores: StoreOption[]; onDone?: () => void }) {
  const searchParams = useSearchParams();
  const currentStoreId = searchParams.get("storeId");

  const [storeId, setStoreId] = useState(currentStoreId && currentStoreId !== "all" ? currentStoreId : stores[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !storeId) {
      setError("Pilih toko dan file dulu.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("storeId", storeId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload gagal.");
      } else {
        setResult(data);
        onDone?.();
      }
    } catch {
      setError("Terjadi kesalahan saat upload.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Toko</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">-- pilih toko --</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">File Laporan Shopee (.xlsx / .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Upload & Proses"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Berhasil: {result.success} dari {result.totalRows} baris diproses.
          {result.skippedOrFailed > 0 && ` ${result.skippedOrFailed} baris dilewati/gagal (cek log).`}
        </div>
      )}
    </form>
  );
}
