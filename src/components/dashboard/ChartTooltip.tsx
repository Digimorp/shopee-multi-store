import { formatRupiah } from "@/lib/format";

/**
 * T-013 batch 18 (Kaca Lembut): tooltip grafik gelap (recharts `content`), muncul saat hover / sentuh.
 * Teks putih di atas #10141A (18:1). Angka rata kanan, tabular.
 */
export default function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; stroke?: string; payload?: any }[];
  label?: string | number;
  labelFormatter?: (label: any) => string;
}) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter ? labelFormatter(label) : label ?? payload[0]?.name;
  return (
    <div className="min-w-[180px] rounded-xl bg-ink px-3 py-2.5 text-xs text-white shadow-glass">
      {title != null && title !== "" && <p className="mb-1 font-bold">{title}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
            {p.name}
          </span>
          <span className="num font-semibold">{formatRupiah(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
