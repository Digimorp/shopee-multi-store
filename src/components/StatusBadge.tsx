// Warna mengikuti MAKNA status (token di tailwind.config.ts), bukan sekadar ganti nama warna:
//   danger  = batal (hasil negatif final)        warning = retur (perlu perhatian; sama dgn kartu "Unit Retur")
//   info    = transit & belum cair (sama-sama "proses", belum final)
//   success = selesai
// TRANSIT dan PENDING_SETTLEMENT sengaja satu warna (info): keduanya "belum final". Retur dijaga tetap
// beda dari Batal karena keduanya tampil berdampingan di kolom Status halaman Retur & Pembatalan.
const STYLES: Record<string, string> = {
  CANCEL: "bg-danger-bg text-danger-text",
  RETUR: "bg-warning-bg text-warning-text",
  TRANSIT: "bg-info-bg text-info-text",
  PENDING_SETTLEMENT: "bg-info-bg text-info-text",
  SELESAI: "bg-success-bg text-success-text",
};

const LABELS: Record<string, string> = {
  CANCEL: "Batal",
  RETUR: "Retur",
  TRANSIT: "Transit",
  PENDING_SETTLEMENT: "Belum Cair",
  SELESAI: "Selesai",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
