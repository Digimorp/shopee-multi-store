"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { StoreOption } from "@/types";

export default function UploadForm({
  stores,
  onDone,
  endpoint = "/api/upload",
  title = "Upload Laporan Pesanan Shopee",
  fileLabel = "File Laporan Pesanan Shopee (.xlsx / .csv)",
  submitLabel = "Upload & Proses",
  hint,
  formatResult,
}: {
  stores: StoreOption[];
  onDone?: () => void;
  endpoint?: string;
  title?: string;
  fileLabel?: string;
  submitLabel?: string;
  hint?: string;
  formatResult?: (data: any) => string;
}) {
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
      const res = await fetch(endpoint, { method: "POST", body: fd });
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

  const defaultResultText = (d: any) =>
    `Berhasil: ${d.success ?? d.orderRows ?? 0} dari ${d.totalRows ?? 0} baris diproses.` +
    (d.skippedOrFailed > 0 ? ` ${d.skippedOrFailed} baris dilewati/gagal.` : "");

  return (
    <form onSubmit={handleSubmit} className="card p-5">
      <p className="mb-1 text-sm font-semibold text-gray-800">{title}</p>
      {hint && <p className="mb-3 text-xs text-gray-400">{hint}</p>}
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Toko</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
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
          <label className="mb-1 block text-xs font-medium text-gray-600">{fileLabel}</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
        {loading ? "Memproses..." : submitLabel}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
          {(formatResult ?? defaultResultText)(result)}
        </div>
      )}
    </form>
  );
}
