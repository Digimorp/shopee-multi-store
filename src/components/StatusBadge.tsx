const STYLES: Record<string, string> = {
  CANCEL: "bg-rose-500",
  RETUR: "bg-amber-500",
  TRANSIT: "bg-blue-500",
  PENDING_SETTLEMENT: "bg-purple-500",
  SELESAI: "bg-emerald-500",
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
        STYLES[status] ?? "bg-gray-400"
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
