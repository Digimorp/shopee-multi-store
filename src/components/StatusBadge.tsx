const STYLES: Record<string, string> = {
  CANCEL: "bg-rose-100 text-rose-700",
  RETUR: "bg-amber-100 text-amber-700",
  TRANSIT: "bg-blue-100 text-blue-700",
  PENDING_SETTLEMENT: "bg-violet-100 text-violet-700",
  SELESAI: "bg-emerald-100 text-emerald-700",
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
