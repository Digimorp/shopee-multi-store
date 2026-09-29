import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- mock @anthropic-ai/sdk sebelum import modul yang diuji ---
// vi.hoisted: fn dibuat sebelum vi.mock di-hoist, jadi aman dipakai di factory.
const { messagesCreate } = vi.hoisted(() => ({ messagesCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: messagesCreate };
    constructor(_opts: unknown) {}
  },
}));

import { analyzeUploadAnomalies, type AnomalyRow } from "@/lib/aiAnomalyCheck";

function toolUseResponse(anomalies: unknown[], summary = "Ringkasan AI.") {
  return {
    content: [
      {
        type: "tool_use",
        name: "report_anomalies",
        id: "tool_1",
        input: { anomalies, summary },
      },
    ],
  };
}

/** 15 baris "wajar" (harga 10.000) + 1 baris outlier (harga 40.000) — grup SKU sama. */
function makeRowsWithPriceOutlier(): AnomalyRow[] {
  const normalRows: AnomalyRow[] = Array.from({ length: 15 }, (_, i) => ({
    rowRef: `SN-${i + 1}`,
    groupKey: "SKU-A",
    numericValues: { unitPrice: 10000 },
  }));
  const outlierRow: AnomalyRow = {
    rowRef: "SN-OUTLIER",
    groupKey: "SKU-A",
    numericValues: { unitPrice: 40000 },
  };
  return [...normalRows, outlierRow];
}

const context = { kind: "order" as const, storeName: "T01 - Toko Test", fileName: "pesanan.xlsx" };

let originalApiKey: string | undefined;

beforeEach(() => {
  messagesCreate.mockReset();
  originalApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalApiKey;
});

describe("analyzeUploadAnomalies — deteksi outlier (rule-based)", () => {
  it("menandai baris dengan harga jauh dari rata-rata grup (>3x std-dev), API mock sukses tanpa tambahan anomali", async () => {
    messagesCreate.mockResolvedValue(toolUseResponse([]));

    const result = await analyzeUploadAnomalies(makeRowsWithPriceOutlier(), context);

    expect(result.aiCheckSkipped).toBe(false);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
    const outlierAnomaly = result.anomalies.find((a) => a.rowRef === "SN-OUTLIER");
    expect(outlierAnomaly).toBeDefined();
    expect(outlierAnomaly!.field).toBe("unitPrice");
    // baris "wajar" tidak boleh ikut ditandai
    expect(result.anomalies.some((a) => a.rowRef === "SN-1")).toBe(false);
  });

  it("menggabungkan anomali rule-based dengan anomali tambahan dari respons AI", async () => {
    messagesCreate.mockResolvedValue(
      toolUseResponse([
        { severity: "high", rowRef: "SN-3", field: "rawStatus", message: "Status pesanan tidak dikenal." },
      ])
    );

    const result = await analyzeUploadAnomalies(makeRowsWithPriceOutlier(), context);

    expect(result.anomalies.some((a) => a.rowRef === "SN-OUTLIER" && a.field === "unitPrice")).toBe(true);
    expect(result.anomalies.some((a) => a.rowRef === "SN-3" && a.field === "rawStatus")).toBe(true);
  });

  it("mendeteksi field wajib kosong yang sudah ditandai caller lewat `issues`, terlepas dari respons AI", async () => {
    messagesCreate.mockResolvedValue(toolUseResponse([]));
    const rows: AnomalyRow[] = [
      { rowRef: "SN-1", groupKey: "SKU-A", numericValues: { unitPrice: 10000 } },
      {
        rowRef: "SN-2",
        groupKey: "SKU-B",
        numericValues: { unitPrice: 5000 },
        issues: [{ field: "sku", message: "SKU tidak ditemukan di Master Produk.", severity: "medium" }],
      },
    ];

    const result = await analyzeUploadAnomalies(rows, context);

    expect(
      result.anomalies.some((a) => a.rowRef === "SN-2" && a.field === "sku" && a.message.includes("Master Produk"))
    ).toBe(true);
  });
});

describe("analyzeUploadAnomalies — fail-open (tidak boleh melempar error)", () => {
  it("API call gagal (rate limit/network) -> tidak throw, aiCheckSkipped true, anomali rule-based tetap ada", async () => {
    messagesCreate.mockRejectedValue(new Error("429 rate limit exceeded"));

    let result;
    await expect(
      (async () => {
        result = await analyzeUploadAnomalies(makeRowsWithPriceOutlier(), context);
      })()
    ).resolves.not.toThrow();

    expect(result!.aiCheckSkipped).toBe(true);
    expect(result!.anomalies.some((a) => a.rowRef === "SN-OUTLIER")).toBe(true);
    expect(typeof result!.summary).toBe("string");
  });

  it("API timeout -> tidak throw, aiCheckSkipped true", async () => {
    messagesCreate.mockImplementation(() => Promise.reject(new Error("Request timed out")));

    const result = await analyzeUploadAnomalies([{ rowRef: "SN-1", numericValues: { qty: 1 } }], context);

    expect(result.aiCheckSkipped).toBe(true);
    expect(Array.isArray(result.anomalies)).toBe(true);
  });

  it("ANTHROPIC_API_KEY belum diset -> tidak memanggil API sama sekali, aiCheckSkipped true", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await analyzeUploadAnomalies(makeRowsWithPriceOutlier(), context);

    expect(messagesCreate).not.toHaveBeenCalled();
    expect(result.aiCheckSkipped).toBe(true);
    // deteksi outlier lokal tetap jalan walau AI dilewati sepenuhnya
    expect(result.anomalies.some((a) => a.rowRef === "SN-OUTLIER")).toBe(true);
  });

  it("respons AI tidak mengandung tool_use valid -> tidak throw, fallback ke rule-based", async () => {
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "maaf, saya tidak bisa membantu" }] });

    const result = await analyzeUploadAnomalies(makeRowsWithPriceOutlier(), context);

    expect(result.aiCheckSkipped).toBe(true);
    expect(result.anomalies.some((a) => a.rowRef === "SN-OUTLIER")).toBe(true);
  });
});
