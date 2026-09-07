const STYLES: Record<string, string> = {
  CANCEL: "bg-red-100 text-red-700",
  RETUR: "bg-amber-100 text-amber-700",
  TRANSIT: "bg-blue-100 text-blue-700",
  PENDING_SETTLEMENT: "bg-purple-100 text-purple-700",
  SELESAI: "bg-green-100 text-green-700",
};

const LABELS: Record<string, string> = {
  CANCEL: "Batal",
  RETUR: "Retur",
  TRANSIT: "Transit",
  PENDING_SETTLEMENT: "Belum Cair",
  SELESAI: "Selesai (Cair)",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-gray-100 text-gray-700"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
