"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { getDefaultPeriod, formatPeriodLabel } from "@/lib/period";

export default function SettingsPeriodsPage() {
  const [cutoffDay, setCutoffDay] = useState(25);
  const [locks, setLocks] = useState<any[]>([]);
  const [newPeriodKey, setNewPeriodKey] = useState("");

  function load() {
    fetch("/api/periods").then((r) => r.json()).then((d) => {
      setCutoffDay(d.cutoffDay ?? 25);
      setLocks(d.locks ?? []);
    });
  }
  useEffect(load, []);

  async function saveCutoff(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/periods", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffDay }),
    });
    load();
  }

  async function toggleLock(periodKey: string, locked: boolean) {
    await fetch("/api/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodKey, locked }),
    });
    load();
  }

  const currentPeriod = getDefaultPeriod(cutoffDay);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Settings Period & Cut-Off</h1>

      <form onSubmit={saveCutoff} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <label className="text-sm text-gray-600">Tanggal Cut-Off tiap bulan:</label>
        <input
          type="number"
          min={1}
          max={28}
          value={cutoffDay}
          onChange={(e) => setCutoffDay(parseInt(e.target.value))}
          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          Simpan
        </button>
        <span className="text-xs text-gray-500">Periode berjalan saat ini: {formatPeriodLabel(currentPeriod)}</span>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Lock Periode</h2>
        <p className="mb-2 text-xs text-gray-500">
          Periode yang dikunci tidak bisa menerima input data baru dari upload — dipakai setelah rekap bulanan final.
          Format key: YYYY-MM-DD_YYYY-MM-DD (dari-sampai).
        </p>
        <div className="mb-3 flex gap-2">
          <input
            placeholder={`contoh: ${currentPeriod.key}`}
            value={newPeriodKey}
            onChange={(e) => setNewPeriodKey(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => newPeriodKey && toggleLock(newPeriodKey, true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Kunci Periode Ini
          </button>
        </div>

        <DataTable
          rowKey={(r: any) => r.id}
          rows={locks}
          columns={[
            { header: "Periode", render: (r) => r.periodKey },
            { header: "Status", render: (r) => (r.locked ? "Terkunci" : "Terbuka") },
            {
              header: "Aksi",
              render: (r) => (
                <button
                  onClick={() => toggleLock(r.periodKey, !r.locked)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  {r.locked ? "Buka Kunci" : "Kunci"}
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
