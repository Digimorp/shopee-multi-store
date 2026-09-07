export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  emptyText = "Tidak ada data.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  rowKey: (row: T, idx: number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            {columns.map((c, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={rowKey(row, idx)} className="transition hover:bg-brand-50/40">
                {columns.map((c, i) => (
                  <td key={i} className={`whitespace-nowrap px-4 py-3 text-gray-700 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
