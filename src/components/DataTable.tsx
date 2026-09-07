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
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={rowKey(row, idx)} className="hover:bg-gray-50">
                {columns.map((c, i) => (
                  <td key={i} className={`px-3 py-2 whitespace-nowrap ${c.className ?? ""}`}>
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
