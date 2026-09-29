"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export type ServerPagination = {
  /** Halaman aktif (1-based) — dikontrol oleh caller (fetch server per halaman). */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const DEFAULT_PAGE_SIZE = 50;

/** Jendela nomor halaman terpotong dengan "..." — mis. [1, "...", 4, 5, 6, "...", 12]. */
function pageWindow(current: number, total: number, delta = 2): (number | "...")[] {
  const pages: (number | "...")[] = [];
  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);

  pages.push(1);
  if (start > 2) pages.push("...");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}

function PageNav({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Halaman sebelumnya"
        className="grid h-8 w-8 place-items-center rounded-lg border border-card-border text-gray-500 hover:enabled:border-brand-300 hover:enabled:text-brand-600 disabled:opacity-40"
      >
        <Icon name="arrowRight" size={14} className="rotate-180" />
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-xs text-gray-400">
            …
          </span>
        ) : (
          <button
            type="button"
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page}
            className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-xs font-medium transition ${
              p === page ? "bg-brand-600 text-white" : "border border-card-border text-gray-500 hover:border-brand-300 hover:text-brand-600"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Halaman berikutnya"
        className="grid h-8 w-8 place-items-center rounded-lg border border-card-border text-gray-500 hover:enabled:border-brand-300 hover:enabled:text-brand-600 disabled:opacity-40"
      >
        <Icon name="arrowRight" size={14} />
      </button>
    </div>
  );
}

/**
 * Tabel reusable dengan pagination bawaan — dipakai semua halaman list/tabel supaya
 * tidak ada baris yang scroll panjang sampai ratusan baris tanpa navigasi halaman.
 *
 * Default (tanpa prop tambahan): paginasi client-side atas `rows` yang sudah di-fetch
 * penuh, page size 50. Kalau data di-fetch per halaman dari server (list besar, mis.
 * Log Aktivitas Admin), isi `serverPagination` — DataTable tidak lagi slice `rows`
 * sendiri (asumsinya `rows` = isi halaman aktif saja) dan nav dikendalikan caller.
 */
export default function DataTable<T>({
  columns,
  rows,
  emptyText = "Tidak ada data.",
  rowKey,
  pageSize = DEFAULT_PAGE_SIZE,
  serverPagination,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  rowKey: (row: T, idx: number) => string;
  pageSize?: number;
  serverPagination?: ServerPagination;
}) {
  const [clientPage, setClientPage] = useState(1);
  const clientTotalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  // Kalau `rows` berubah (mis. filter diganti) dan halaman lama jadi tidak valid, balik ke halaman 1.
  useEffect(() => {
    if (!serverPagination && clientPage > clientTotalPages) setClientPage(1);
  }, [clientTotalPages, serverPagination, clientPage]);

  const page = serverPagination ? serverPagination.page : clientPage;
  const totalPages = serverPagination ? serverPagination.totalPages : clientTotalPages;
  const pagedRows = serverPagination ? rows : rows.slice((clientPage - 1) * pageSize, clientPage * pageSize);
  const changePage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (serverPagination) serverPagination.onPageChange(next);
    else setClientPage(next);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-brand-50/40">
              {columns.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => (
                <tr key={rowKey(row, idx)} className="transition hover:bg-brand-50/40">
                  {columns.map((c, i) => (
                    <td key={i} className={`whitespace-nowrap px-4 py-3 text-gray-700 ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border px-4 py-3">
          <span className="text-xs text-gray-400">
            Halaman {page} dari {totalPages}
            {!serverPagination ? ` · ${rows.length} baris` : ""}
          </span>
          <PageNav page={page} totalPages={totalPages} onChange={changePage} />
        </div>
      )}
    </div>
  );
}
