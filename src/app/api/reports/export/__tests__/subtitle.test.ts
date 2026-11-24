import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

// T-013 batch4 H: Excel Rekap tanpa subjudul periode (isinya memuat rentang lebih luas),
// laporan lain tetap bersubjudul bila parameter period ada.
const { getSessionUser, resolveFilters, buildReportDataset } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  resolveFilters: vi.fn(),
  buildReportDataset: vi.fn(),
}));
vi.mock("@/lib/rbac", () => ({ getSessionUser }));
vi.mock("@/lib/queryFilters", () => ({ resolveFilters }));
vi.mock("@/lib/reports", () => ({ buildReportDataset, datasetToPdfRows: () => [] }));

import { GET } from "@/app/api/reports/export/route";

const DS = {
  title: "Laporan Uji",
  columns: [
    { key: "a", header: "Kolom A", width: 10 },
    { key: "n", header: "Nilai", width: 10, kind: "money" },
  ],
  rows: [{ a: "x", n: 1000 }],
  summary: [],
};

async function firstRows(query: string) {
  const res = await GET(new NextRequest(`http://localhost/api/reports/export?${query}`));
  expect(res.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as any);
  const ws = wb.worksheets[0];
  return [1, 2, 3].map((n) => (ws.getRow(n).values as any[]).slice(1));
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "u1", role: "OWNER" });
  resolveFilters.mockResolvedValue({
    storeIds: ["s1", "s2"],
    from: new Date("2026-07-25T17:00:00Z"),
    to: new Date("2026-08-25T16:59:59.999Z"),
  });
  buildReportDataset.mockResolvedValue(DS);
});

describe("export Excel: subjudul periode per laporan", () => {
  it("Rekap Bulanan: tanpa subjudul, header di baris 1", async () => {
    const rows = await firstRows("report=recap&type=monthly&format=xlsx&period=2026-08");
    expect(rows[0]).toEqual(["Kolom A", "Nilai"]);
    expect(rows[1]).toEqual(["x", 1000]);
  });

  it.each(["profit", "orders", "barang-keluar", "retur", "cashflow", "performa-toko"])(
    "%s: tetap bersubjudul, header di baris 3",
    async (report) => {
      const rows = await firstRows(`report=${report}&format=xlsx&period=2026-08`);
      expect(rows[0]).toEqual(["Periode Agustus 2026  -  2 toko"]);
      expect(rows[1]).toEqual([]);
      expect(rows[2]).toEqual(["Kolom A", "Nilai"]);
    }
  );
});
