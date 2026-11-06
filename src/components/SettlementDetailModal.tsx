"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { SettleBadge } from "@/components/StageBadge";
import { formatRupiah, formatNumber } from "@/lib/format";
import { settlementBreakdown, type SettlementLine } from "@/lib/settlement";

type ReconOrder = { orderSn: string; estimasi: number; aktual: number | null; settleStatus: string; storeCode: string };

const money = (v: number | null) => (v == null ? <span className="text-gray-300">— belum cair</span> : formatRupiah(v));
const signed = (v: number | null) =>
  v == null ? <span className="text-gray-300">—</span> : <span className={v < 0 ? "text-rose-600" : ""}>{formatRupiah(v)}</span>;

/**
 * Popup Settlement Details: breakdown per baris SKU dalam 1 No. Pesanan. Pola overlay sama dengan
 * ConfirmDialog (klik luar / Esc = tutup). Angka dihitung lewat settlementBreakdown() — rumus
 * sama dengan Laporan Profit, jadi totalnya konsisten dengan laporan itu.
 */
export default function SettlementDetailModal({
  order,
  qs,
  onClose,
}: {
  order: ReconOrder;
  qs: string; // filter aktif (storeId/from/to) -> scope toko tetap dari server
  onClose: () => void;
}) {
  const [lines, setLines] = useState<SettlementLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(qs);
    p.set("orderSn", order.orderSn);
    fetch(`/api/orders?${p.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setLines(d.orders ?? []))
      .catch(() => setError(true));
  }, [order.orderSn, qs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = useMemo(() => (lines ? settlementBreakdown(lines, order) : null), [lines, order]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-card-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="settlement-title" className="text-sm font-semibold text-gray-800">
              Settlement Details · {order.orderSn}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {order.storeCode} · Payout order {order.aktual == null ? "belum ada" : formatRupiah(order.aktual)} dari estimasi{" "}
              {formatRupiah(order.estimasi)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SettleBadge status={order.settleStatus} />
            <button onClick={onClose} aria-label="Tutup" className="text-gray-300 hover:text-gray-500">
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        {error ? (
          <p className="py-8 text-center text-sm text-rose-600">Gagal memuat baris pesanan.</p>
        ) : !data ? (
          <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Produk</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Omzet Bruto</th>
                  <th className="px-3 py-2 text-right font-semibold">Uang Cair</th>
                  <th className="px-3 py-2 text-right font-semibold">Profit HPP</th>
                  <th className="px-3 py-2 text-right font-semibold">Profit Agen</th>
                  <th className="px-3 py-2 text-right font-semibold">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <span className="block max-w-[200px] truncate">{r.productName}</span>
                      {r.sku && <span className="text-[11px] text-gray-400">{r.sku}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.qty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(r.grossOmzet)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.uangCair)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{signed(r.profitHpp)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(r.profitAgen)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{signed(r.selisih)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 font-semibold text-gray-900">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    Total order
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(data.totals.grossOmzet)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.uangCair)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{signed(data.totals.profitHpp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(data.totals.profitAgen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{signed(data.totals.selisih)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-gray-400">
          Payout Shopee dicatat per No. Pesanan, jadi Uang Cair per SKU = porsi proporsional dari payout order. Profit HPP =
          Uang Cair − HPP × qty. Selisih = Profit Agen − Profit HPP (rumus sama dengan Laporan Profit).
        </p>
      </div>
    </div>
  );
}
