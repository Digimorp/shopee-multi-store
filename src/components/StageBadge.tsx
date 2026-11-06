const STAGES: Record<string, { label: string; cls: string }> = {
  SAMPAI: { label: "Barang Sampai · est.", cls: "bg-blue-100 text-blue-700" },
  MENUNGGU_CAIR: { label: "Menunggu Cair · est.", cls: "bg-amber-100 text-amber-700" },
  CAIR: { label: "Cair · aktual", cls: "bg-emerald-100 text-emerald-700" },
  CAIR_FINAL: { label: "Cair Final · terkunci", cls: "bg-emerald-600 text-white" },
};

export default function StageBadge({ stage }: { stage: string }) {
  const s = STAGES[stage] ?? { label: stage, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// Status pencairan per No. Pesanan (lihat deriveSettleStatus). Warna ikut palet badge existing:
// emerald = cair (StageBadge CAIR), amber = menunggu (MENUNGGU_CAIR), violet = StatusBadge.
const SETTLE: Record<string, { label: string; cls: string; title: string }> = {
  AKTUAL: { label: "Aktual", cls: "bg-emerald-100 text-emerald-700", title: "Sudah cair penuh" },
  SEBAGIAN: {
    label: "Sebagian Cair",
    cls: "bg-violet-100 text-violet-700",
    title: "Sudah ada payout, tapi sebagian baris diretur / ada pengembalian dana",
  },
  BELUM: { label: "Belum Cair", cls: "bg-amber-100 text-amber-700", title: "Belum muncul di Income Report" },
};

export function SettleBadge({ status }: { status: string }) {
  const s = SETTLE[status] ?? { label: status, cls: "bg-gray-100 text-gray-600", title: "" };
  return (
    <span
      title={s.title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

const RECON: Record<string, string> = {
  MATCH: "bg-emerald-500",
  SELISIH: "bg-amber-500",
  BELUM_KETEMU: "bg-rose-500",
};

export function ReconBadge({ category }: { category: string }) {
  const label = category === "BELUM_KETEMU" ? "Belum Ketemu" : category === "SELISIH" ? "Selisih" : "Cair";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white ${
        RECON[category] ?? "bg-gray-400"
      }`}
    >
      {label}
    </span>
  );
}
