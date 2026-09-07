export default function SummaryCard({
  label,
  value,
  accent = "brand",
}: {
  label: string;
  value: string;
  accent?: "brand" | "green" | "purple" | "blue" | "red";
}) {
  const borderColor: Record<string, string> = {
    brand: "border-l-brand-500",
    green: "border-l-green-500",
    purple: "border-l-purple-500",
    blue: "border-l-blue-500",
    red: "border-l-red-500",
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm border-l-4 ${borderColor[accent]}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
