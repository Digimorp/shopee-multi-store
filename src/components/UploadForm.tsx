"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { StoreOption } from "@/types";
import AiAnomalyPanel from "@/components/AiAnomalyPanel";
import HppUnknownBanner from "@/components/HppUnknownBanner";
import { detectFromBuffer, UPLOAD_KIND_LABEL, type UploadKind } from "@/lib/detectUploadFile";

/**
 * T-013 batch 15 (bagian A): SATU form upload. Toko dipilih sekali, 1-2 file sekaligus, jenis file
 * dideteksi dari strukturnya (src/lib/detectUploadFile.ts) dan bisa diganti manual. Backend TETAP dua
 * endpoint lama: Laporan Pesanan -> /api/upload, Income Report -> /api/income/import.
 * Urutan proses: pesanan dulu, lalu income. Urutan tidak mengubah hasil laporan (kedua endpoint tidak
 * saling membaca tabel; Uang Cair/rekonsiliasi dihitung saat laporan dibuka).
 */
const ENDPOINT: Record<UploadKind, string> = { pesanan: "/api/upload", income: "/api/income/import" };
const MAX_FILES = 2;

type Item = {
  file: File;
  detected: UploadKind | null;
  kind: UploadKind | null; // hasil deteksi, atau pilihan manual
  message: string;
  status: "siap" | "proses" | "berhasil" | "gagal" | "dilewati";
  resultText?: string;
  result?: any;
  error?: string;
};

// T-013 batch 12: upload pesanan idempoten -> hitungan baru / diperbarui / tidak berubah / dilewati.
export const pesananResultText = (d: any) =>
  typeof d.created === "number"
    ? `Dari ${d.totalRows ?? 0} baris: ${d.created} baru, ${d.updated ?? 0} diperbarui, ${d.unchanged ?? 0} tidak berubah, ${d.skippedLocked ?? 0} dilewati (periode terkunci).` +
      (d.statusKept > 0 ? ` ${d.statusKept} baris membawa status lebih lama dari data tersimpan; status tidak diturunkan.` : "") +
      (d.parseErrors?.length ? ` ${d.parseErrors.length} baris tidak terbaca.` : "")
    : `Berhasil: ${d.success ?? 0} dari ${d.totalRows ?? 0} baris diproses.` +
      (d.skippedOrFailed > 0 ? ` ${d.skippedOrFailed} baris dilewati/gagal.` : "");

export const incomeResultText = (d: any) =>
  `Berhasil: ${d.orderRows} baris order + ${d.adjustmentRows} adjustment (v${d.version}).` +
  (d.supersededCount > 0 ? ` ${d.supersededCount} import lama ditandai kadaluarsa.` : "") +
  (d.parseErrors?.length ? ` ${d.parseErrors.length} baris error.` : "");

const KIND_ORDER: Record<UploadKind, number> = { pesanan: 0, income: 1 };

export default function UploadForm({ stores, onDone }: { stores: StoreOption[]; onDone?: () => void }) {
  const searchParams = useSearchParams();
  const currentStoreId = searchParams.get("storeId");
  const { data: session } = useSession();
  const isOwner = (session?.user as any)?.role === "OWNER";
  // Akun nonaktif / terhapus: jangan tampilkan pesan "belum dihubungkan" (InvalidSessionGuard akan signOut).
  const sessionInvalid = (session?.user as any)?.invalid === true;

  const [storeId, setStoreId] = useState(currentStoreId && currentStoreId !== "all" ? currentStoreId : stores[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function onPick(list: FileList | null) {
    setError(null);
    const files = Array.from(list ?? []);
    if (files.length > MAX_FILES) {
      setError(`Maksimal ${MAX_FILES} file sekaligus.`);
      setItems([]);
      setInputKey((k) => k + 1);
      return;
    }
    const next: Item[] = [];
    for (const file of files) {
      const det = detectFromBuffer(new Uint8Array(await file.arrayBuffer()));
      next.push({ file, detected: det.kind, kind: det.kind, message: det.message, status: "siap" });
    }
    setItems(next);
  }

  const setKind = (i: number, kind: UploadKind) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, kind } : it)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return setError("Pilih toko dulu.");
    const runnable = items.filter((it) => it.kind && it.status === "siap");
    if (runnable.length === 0) return setError(items.length ? "Tidak ada file yang bisa diproses." : "Pilih file dulu.");
    setLoading(true);
    setError(null);

    const order = items.map((it, i) => i).sort((a, b) => {
      const ka = items[a].kind, kb = items[b].kind;
      return (ka ? KIND_ORDER[ka] : 9) - (kb ? KIND_ORDER[kb] : 9);
    });
    const done = [...items];
    for (const i of order) {
      const it = done[i];
      if (it.status !== "siap") continue; // sudah diproses di klik sebelumnya
      if (!it.kind) {
        done[i] = { ...it, status: "dilewati" };
        continue;
      }
      done[i] = { ...it, status: "proses" };
      setItems([...done]);
      const fd = new FormData();
      fd.append("file", it.file);
      fd.append("storeId", storeId);
      try {
        const res = await fetch(ENDPOINT[it.kind], { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        done[i] = res.ok
          ? {
              ...it,
              status: "berhasil",
              result: data,
              resultText: it.kind === "pesanan" ? pesananResultText(data) : incomeResultText(data),
            }
          : { ...it, status: "gagal", error: data.error ?? "Upload gagal." };
      } catch {
        done[i] = { ...it, status: "gagal", error: "Terjadi kesalahan saat upload." };
      }
      setItems([...done]);
    }
    setLoading(false);
    setInputKey((k) => k + 1); // pilih file lagi (termasuk file yang sama) untuk upload berikutnya
    onDone?.();
  }

  if (stores.length === 0) {
    return (
      <div className="card p-6">
        <p className="mb-1 text-sm font-semibold text-gray-800">Upload Data</p>
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {isOwner ? (
            <>
              Belum ada toko,{" "}
              <a href="/pengaturan?tab=toko" className="font-medium underline hover:no-underline">
                tambahkan di Pengaturan &gt; Toko
              </a>{" "}
              dulu sebelum upload.
            </>
          ) : sessionInvalid ? null : (
            "Akun kamu belum dihubungkan ke toko. Hubungi Owner."
          )}
        </div>
      </div>
    );
  }

  const canSubmit = !loading && !!storeId && items.some((it) => it.kind && it.status === "siap");

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <p className="mb-1 text-sm font-semibold text-gray-800">Upload Data</p>
      <p className="mb-3 text-xs text-gray-500">
        Laporan Pesanan = Order.all dari Shopee (termasuk file On Proses). Income Report = Saldo Penghasilan. Boleh
        pilih 1-2 file sekaligus; jenis file dikenali otomatis.
      </p>
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
          <label className="mb-1 block text-xs font-medium text-gray-600">File (.xlsx / .xls / .csv, maks. 2)</label>
          <input
            key={inputKey}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(e) => onPick(e.target.files)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mb-3 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" data-upload-file>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{it.file.name}</span>
                {it.detected ? (
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    {it.kind === it.detected ? "Terdeteksi:" : "Dipilih manual:"}
                    <select
                      value={it.kind ?? ""}
                      disabled={loading || it.status !== "siap"}
                      onChange={(e) => setKind(i, e.target.value as UploadKind)}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                    >
                      <option value="pesanan">{UPLOAD_KIND_LABEL.pesanan}</option>
                      <option value="income">{UPLOAD_KIND_LABEL.income}</option>
                    </select>
                  </label>
                ) : (
                  <span className="text-xs font-medium text-rose-600">Tidak dikenali</span>
                )}
              </div>
              {!it.detected && <p className="mt-1 text-xs text-rose-600">{it.message}</p>}
              {it.status === "proses" && <p className="mt-1 text-xs text-gray-500">Memproses…</p>}
              {it.status === "berhasil" && (
                <p className="mt-1 rounded-lg bg-success-bg px-2 py-1 text-xs text-success-text">{it.resultText}</p>
              )}
              {it.status === "gagal" && <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{it.error}</p>}
              {it.status === "berhasil" && it.kind === "pesanan" && (
                <>
                  <HppUnknownBanner hppUnknown={it.result?.hppUnknown} />
                  <AiAnomalyPanel
                    anomalies={it.result?.aiAnomalies ?? []}
                    summary={it.result?.aiSummary}
                    aiCheckSkipped={it.result?.aiCheckSkipped}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="submit" disabled={!canSubmit} className="btn-primary disabled:opacity-50">
        {loading ? "Memproses..." : "Upload & Proses"}
      </button>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </form>
  );
}
