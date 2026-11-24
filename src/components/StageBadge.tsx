// Tahap pencairan, warna = token di tailwind.config.ts: info = barang sampai (proses),
// warning = menunggu cair, success = cair. CAIR_FINAL solid (bukan soft) supaya "terkunci" menonjol.
const STAGES: Record<string, { label: string; cls: string }> = {
  SAMPAI: { label: "Barang Sampai · est.", cls: "bg-info-bg text-info-text" },
  MENUNGGU_CAIR: { label: "Menunggu Cair · est.", cls: "bg-warning-bg text-warning-text" },
  CAIR: { label: "Cair · aktual", cls: "bg-success-bg text-success-text" },
  CAIR_FINAL: { label: "Cair Final · terkunci", cls: "bg-success text-white" },
};

export default function StageBadge({ stage }: { stage: string }) {
  const s = STAGES[stage] ?? { label: stage, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// Status pencairan per No. Pesanan (lihat deriveSettleStatus). Warna ikut token yang sama dgn StageBadge/
// StatusBadge: success = cair penuh, info = sebagian cair (proses), warning = belum/menunggu cair.
// Ketiganya tampil di kolom yang sama (Rekonsiliasi), jadi harus tetap saling beda warna.
const SETTLE: Record<string, { label: string; cls: string; title: string }> = {
  AKTUAL: { label: "Aktual", cls: "bg-success-bg text-success-text", title: "Sudah cair penuh" },
  SEBAGIAN: {
    label: "Sebagian Cair",
    cls: "bg-info-bg text-info-text",
    title: "Sudah ada payout, tapi sebagian baris diretur / ada pengembalian dana",
  },
  BELUM: { label: "Belum Cair", cls: "bg-warning-bg text-warning-text", title: "Belum muncul di Income Report" },
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

// Badge kategori rekonsiliasi = SOLID (isi penuh). Teks putih utk success/danger (kontras 6,9:1 / 4,0:1);
// warning memakai teks gelap karena mustard + putih hanya ~1,8:1 (neutral-900 di atasnya 9,7:1).
const RECON: Record<string, string> = {
  MATCH: "bg-success text-white",
  SELISIH: "bg-warning text-neutral-900",
  BELUM_KETEMU: "bg-danger text-white",
};

export function ReconBadge({ category }: { category: string }) {
  const label = category === "BELUM_KETEMU" ? "Belum Ketemu" : category === "SELISIH" ? "Selisih" : "Cair";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        RECON[category] ?? "bg-gray-400 text-white"
      }`}
    >
      {label}
    </span>
  );
}
