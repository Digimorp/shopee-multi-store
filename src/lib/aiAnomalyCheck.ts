import Anthropic from "@anthropic-ai/sdk";

// Lapisan AI Anomaly Check — dipanggil SETELAH file berhasil diparsing, SEBELUM data
// masuk ke DB secara permanen (upload/import tetap jalan seperti biasa; ini hanya
// menambahkan informasi anomali untuk admin, tidak pernah membatalkan proses).
//
// Fail-open by design: kalau Claude API gagal/timeout/rate-limit/key belum diset,
// fungsi ini TIDAK melempar error — ia mengembalikan aiCheckSkipped: true dan proses
// upload/import di route pemanggil tetap lanjut tanpa terpengaruh.

export type AnomalySeverity = "low" | "medium" | "high";

export interface Anomaly {
  severity: AnomalySeverity;
  rowRef: string;
  field: string;
  message: string;
}

export interface AiAnomalyResult {
  anomalies: Anomaly[];
  summary: string;
  aiCheckSkipped: boolean;
}

export type UploadKind = "order" | "income" | "product";

/** Masalah yang sudah dideteksi secara deterministik oleh caller (bukan oleh AI) — mis.
 * SKU tidak ditemukan di Master Produk, field wajib kosong, dll. Selalu ikut ditampilkan
 * di hasil akhir terlepas dari sukses/gagalnya panggilan AI. */
export interface KnownIssue {
  field: string;
  message: string;
  severity?: AnomalySeverity;
}

export interface AnomalyRow {
  /** Identitas baris untuk pesan anomali, mis. No. Pesanan atau SKU. */
  rowRef: string;
  /** Kunci pengelompokan untuk statistik "wajar" per grup, mis. SKU produk. */
  groupKey?: string;
  /** Field numerik yang dicek outlier-nya (harga, qty, nilai cair, dll). */
  numericValues?: Record<string, number>;
  /** Label kategori untuk distribusi (status pesanan, tipe transaksi, dll). */
  statusLabel?: string;
  /** Tanggal baris — dipakai untuk distribusi tanggal & cek di luar periode file. */
  date?: Date | null;
  /** Masalah yang sudah diketahui pasti oleh caller. */
  issues?: KnownIssue[];
}

export interface AnomalyCheckContext {
  kind: UploadKind;
  storeName: string;
  fileName: string;
  periodLabel?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

const MODEL = "claude-sonnet-5";
const RAW_ROW_LIMIT = 200; // di atas ini, hanya kirim ringkasan statistik + baris outlier
const MAX_OUTLIER_ROWS = 60;
const MAX_TOP_GROUPS = 30;
const MAX_AI_ANOMALIES = 50;
const REQUEST_TIMEOUT_MS = 20_000;

const KIND_LABEL: Record<UploadKind, string> = {
  order: "Laporan Pesanan Shopee",
  income: "Income Report / Laporan Pendapatan Shopee",
  product: "Master Produk & HPP",
};

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

interface GroupNumericStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;
}

function computeFieldStats(values: number[]): GroupNumericStats {
  const m = mean(values);
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), mean: m, stddev: stddev(values, m) };
}

interface RowFlag {
  field: string;
  message: string;
  severity: AnomalySeverity;
}

interface FlaggedRow {
  rowRef: string;
  groupKey?: string;
  flags: RowFlag[];
}

/** Deteksi anomali deterministik: field wajib kosong / SKU tak match (dari caller),
 * outlier numerik (>3x std-dev dari rata-rata grup atau rata-rata global), dan baris
 * duplikat persis (rowRef + groupKey + semua nilai numerik sama). Murah secara komputasi
 * dan tidak butuh panggilan API — dipakai baik untuk memilih baris outlier yang dikirim
 * ke Claude, maupun sebagai fallback kalau panggilan AI gagal. */
function detectRuleBasedFlags(rows: AnomalyRow[]): Map<number, FlaggedRow> {
  const flaggedByIndex = new Map<number, FlaggedRow>();

  function addFlag(idx: number, flag: RowFlag) {
    const row = rows[idx];
    const existing = flaggedByIndex.get(idx);
    if (existing) {
      existing.flags.push(flag);
    } else {
      flaggedByIndex.set(idx, { rowRef: row.rowRef, groupKey: row.groupKey, flags: [flag] });
    }
  }

  // 1. Issue yang sudah pasti dari caller.
  rows.forEach((row, idx) => {
    for (const issue of row.issues ?? []) {
      addFlag(idx, { field: issue.field, message: issue.message, severity: issue.severity ?? "medium" });
    }
  });

  // 2. Outlier numerik per grup (fallback ke global kalau grup terlalu kecil).
  const fieldNames = new Set<string>();
  rows.forEach((r) => Object.keys(r.numericValues ?? {}).forEach((f) => fieldNames.add(f)));

  for (const field of fieldNames) {
    const globalValues = rows.map((r) => r.numericValues?.[field]).filter((v): v is number => typeof v === "number");
    const globalStats = globalValues.length >= 5 ? computeFieldStats(globalValues) : null;

    const byGroup = new Map<string, number[]>();
    rows.forEach((r) => {
      const v = r.numericValues?.[field];
      if (typeof v !== "number" || !r.groupKey) return;
      const arr = byGroup.get(r.groupKey) ?? [];
      arr.push(v);
      byGroup.set(r.groupKey, arr);
    });
    const groupStats = new Map<string, GroupNumericStats>();
    for (const [key, values] of byGroup) {
      if (values.length >= 3) groupStats.set(key, computeFieldStats(values));
    }

    rows.forEach((row, idx) => {
      const v = row.numericValues?.[field];
      if (typeof v !== "number") return;
      const gs = row.groupKey ? groupStats.get(row.groupKey) : undefined;
      if (gs && gs.stddev > 0 && Math.abs(v - gs.mean) > 3 * gs.stddev) {
        addFlag(idx, {
          field,
          severity: Math.abs(v - gs.mean) > 5 * gs.stddev ? "high" : "medium",
          message: `Nilai "${field}" (${v}) jauh dari rata-rata grup "${row.groupKey}" (rata-rata ${gs.mean.toFixed(2)}).`,
        });
      } else if (!gs && globalStats && globalStats.stddev > 0 && Math.abs(v - globalStats.mean) > 3 * globalStats.stddev) {
        addFlag(idx, {
          field,
          severity: "medium",
          message: `Nilai "${field}" (${v}) jauh dari rata-rata keseluruhan (rata-rata ${globalStats.mean.toFixed(2)}).`,
        });
      }
    });
  }

  // 3. Duplikat persis (rowRef + groupKey + nilai numerik identik).
  const dupKeyCount = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    if (!row.rowRef) return;
    const numKey = JSON.stringify(Object.entries(row.numericValues ?? {}).sort());
    const key = `${row.rowRef}::${row.groupKey ?? ""}::${numKey}`;
    const arr = dupKeyCount.get(key) ?? [];
    arr.push(idx);
    dupKeyCount.set(key, arr);
  });
  for (const indices of dupKeyCount.values()) {
    if (indices.length > 1) {
      for (const idx of indices) {
        addFlag(idx, {
          field: "rowRef",
          severity: "medium",
          message: `Baris duplikat persis — kombinasi ini muncul ${indices.length} kali di file.`,
        });
      }
    }
  }

  // 4. Tanggal yang gagal terbaca sama sekali.
  rows.forEach((row, idx) => {
    if (!row.date) return;
    if (isNaN(row.date.getTime())) {
      addFlag(idx, { field: "date", severity: "low", message: "Tanggal baris tidak valid/tidak terbaca." });
    }
  });

  return flaggedByIndex;
}

function markOutOfPeriod(rows: AnomalyRow[], flaggedByIndex: Map<number, FlaggedRow>, context: AnomalyCheckContext) {
  if (!context.periodStart || !context.periodEnd) return;
  const start = context.periodStart.getTime();
  const end = context.periodEnd.getTime();
  rows.forEach((row, idx) => {
    if (!row.date || isNaN(row.date.getTime())) return;
    const t = row.date.getTime();
    if (t < start || t > end) {
      const flag: RowFlag = {
        field: "date",
        severity: "low",
        message: `Tanggal baris (${row.date.toISOString().slice(0, 10)}) di luar periode file.`,
      };
      const existing = flaggedByIndex.get(idx);
      if (existing) existing.flags.push(flag);
      else flaggedByIndex.set(idx, { rowRef: row.rowRef, groupKey: row.groupKey, flags: [flag] });
    }
  });
}

function buildStatSummary(rows: AnomalyRow[], context: AnomalyCheckContext) {
  const statusDistribution: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.statusLabel) return;
    statusDistribution[r.statusLabel] = (statusDistribution[r.statusLabel] ?? 0) + 1;
  });

  const dates = rows.map((r) => r.date).filter((d): d is Date => !!d && !isNaN(d.getTime()));
  const dateStats =
    dates.length > 0
      ? {
          min: new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10),
          max: new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10),
          distinctDays: new Set(dates.map((d) => d.toISOString().slice(0, 10))).size,
        }
      : null;

  const fieldNames = new Set<string>();
  rows.forEach((r) => Object.keys(r.numericValues ?? {}).forEach((f) => fieldNames.add(f)));

  const overallFieldStats: Record<string, { min: number; max: number; mean: number }> = {};
  for (const field of fieldNames) {
    const values = rows.map((r) => r.numericValues?.[field]).filter((v): v is number => typeof v === "number");
    if (values.length === 0) continue;
    const m = mean(values);
    overallFieldStats[field] = { min: Math.min(...values), max: Math.max(...values), mean: Math.round(m * 100) / 100 };
  }

  // Rata-rata per grup (mis. per SKU) — dibatasi ke grup dengan baris terbanyak supaya ringkas.
  const groupCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.groupKey) return;
    groupCounts.set(r.groupKey, (groupCounts.get(r.groupKey) ?? 0) + 1);
  });
  const topGroups = [...groupCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_GROUPS)
    .map(([groupKey, count]) => {
      const groupRows = rows.filter((r) => r.groupKey === groupKey);
      const fields: Record<string, { min: number; max: number; mean: number }> = {};
      for (const field of fieldNames) {
        const values = groupRows.map((r) => r.numericValues?.[field]).filter((v): v is number => typeof v === "number");
        if (values.length === 0) continue;
        const m = mean(values);
        fields[field] = { min: Math.min(...values), max: Math.max(...values), mean: Math.round(m * 100) / 100 };
      }
      return { groupKey, count, fields };
    });

  return {
    kind: context.kind,
    store: context.storeName,
    fileName: context.fileName,
    period: context.periodLabel ?? null,
    totalRows: rows.length,
    statusDistribution,
    dateStats,
    overallFieldStats,
    topGroupStats: topGroups,
  };
}

const ANOMALY_TOOL: Anthropic.Tool = {
  name: "report_anomalies",
  description:
    "Laporkan anomali yang ditemukan pada data upload Shopee (harga/qty tidak wajar, duplikat, tanggal di luar periode, status tak dikenal, dll) dalam format JSON terstruktur.",
  input_schema: {
    type: "object",
    properties: {
      anomalies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["low", "medium", "high"] },
            rowRef: { type: "string", description: "Identitas baris, mis. No. Pesanan atau SKU" },
            field: { type: "string", description: "Nama field yang bermasalah" },
            message: { type: "string", description: "Penjelasan singkat anomali dalam Bahasa Indonesia" },
          },
          required: ["severity", "rowRef", "field", "message"],
          additionalProperties: false,
        },
      },
      summary: { type: "string", description: "Ringkasan umum hasil pemeriksaan, 1-3 kalimat, Bahasa Indonesia" },
    },
    required: ["anomalies", "summary"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `Kamu adalah auditor data untuk sistem rekonsiliasi penjualan Shopee multi-toko.
Kamu menerima ringkasan statistik dan/atau sebagian baris dari file yang baru diupload admin
(Laporan Pesanan, Income Report, atau Master Produk). Tugasmu HANYA mencari dan melaporkan
anomali (harga/qty tidak wajar, duplikat No. Pesanan, tanggal di luar periode file, status
pesanan tak dikenal, field kosong, SKU tak match Master Produk, dsb) — kamu TIDAK mengubah
data dan TIDAK memutuskan apakah upload boleh lanjut (upload selalu lanjut, ini hanya laporan
informasi untuk admin). Perhatikan konteks bisnis berikut supaya tidak salah menandai hal yang
wajar: satu No. Pesanan BOLEH muncul berkali-kali kalau pesanan berisi banyak SKU berbeda
(multi-item order) — itu bukan anomali. Selalu balas lewat tool "report_anomalies".`;

function buildUserPrompt(
  context: AnomalyCheckContext,
  statSummary: ReturnType<typeof buildStatSummary>,
  sampleRows: unknown[],
  mode: "full" | "summary"
) {
  const header =
    `Jenis file: ${KIND_LABEL[context.kind]}\n` +
    `Toko: ${context.storeName}\n` +
    `Nama file: ${context.fileName}\n` +
    (context.periodLabel ? `Periode: ${context.periodLabel}\n` : "") +
    `Total baris: ${statSummary.totalRows}\n\n`;

  const statBlock = `Ringkasan statistik:\n${JSON.stringify(statSummary, null, 2)}\n\n`;

  const rowsBlock =
    mode === "full"
      ? `Seluruh baris (${sampleRows.length}):\n${JSON.stringify(sampleRows)}`
      : `Baris yang secara statistik mencurigakan/outlier (maks ${MAX_OUTLIER_ROWS}, dari total ${statSummary.totalRows}):\n${JSON.stringify(sampleRows)}`;

  return header + statBlock + rowsBlock;
}

function toRowPayload(row: AnomalyRow) {
  return {
    rowRef: row.rowRef,
    groupKey: row.groupKey,
    statusLabel: row.statusLabel,
    date: row.date && !isNaN(row.date.getTime()) ? row.date.toISOString().slice(0, 10) : null,
    numericValues: row.numericValues,
    knownIssues: row.issues?.map((i) => i.message),
  };
}

function ruleBasedAnomalies(flaggedByIndex: Map<number, FlaggedRow>): Anomaly[] {
  const out: Anomaly[] = [];
  for (const flagged of flaggedByIndex.values()) {
    for (const flag of flagged.flags) {
      out.push({ severity: flag.severity, rowRef: flagged.rowRef, field: flag.field, message: flag.message });
    }
  }
  return out;
}

function dedupeAnomalies(anomalies: Anomaly[]): Anomaly[] {
  const seen = new Set<string>();
  const out: Anomaly[] = [];
  for (const a of anomalies) {
    const key = `${a.rowRef}::${a.field}::${a.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function isValidSeverity(v: unknown): v is AnomalySeverity {
  return v === "low" || v === "medium" || v === "high";
}

function parseAiAnomalies(input: unknown): { anomalies: Anomaly[]; summary: string } | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const rawList = Array.isArray(obj.anomalies) ? obj.anomalies : [];
  const anomalies: Anomaly[] = [];
  for (const item of rawList.slice(0, MAX_AI_ANOMALIES)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (!isValidSeverity(rec.severity)) continue;
    if (typeof rec.rowRef !== "string" || typeof rec.field !== "string" || typeof rec.message !== "string") continue;
    anomalies.push({ severity: rec.severity, rowRef: rec.rowRef, field: rec.field, message: rec.message });
  }
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  return { anomalies, summary };
}

/**
 * Analisis anomali AI untuk baris hasil parsing (order/income/product) sebelum di-commit
 * ke DB. Fail-open: kalau API key belum diset, atau panggilan API gagal/timeout, fungsi ini
 * TIDAK melempar — ia mengembalikan aiCheckSkipped: true dan anomali rule-based (kalau ada)
 * supaya proses upload di route pemanggil tetap sukses seperti biasa.
 */
export async function analyzeUploadAnomalies(rows: AnomalyRow[], context: AnomalyCheckContext): Promise<AiAnomalyResult> {
  if (rows.length === 0) {
    return { anomalies: [], summary: "Tidak ada baris untuk dianalisis.", aiCheckSkipped: false };
  }

  const flaggedByIndex = detectRuleBasedFlags(rows);
  markOutOfPeriod(rows, flaggedByIndex, context);
  const localAnomalies = ruleBasedAnomalies(flaggedByIndex);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[aiAnomalyCheck] ANTHROPIC_API_KEY belum diset — AI check dilewati, lanjut tanpa AI.");
    return {
      anomalies: dedupeAnomalies(localAnomalies),
      summary: "Pemeriksaan AI dilewati (ANTHROPIC_API_KEY belum diset). Data tetap tersimpan seperti biasa.",
      aiCheckSkipped: true,
    };
  }

  const statSummary = buildStatSummary(rows, context);
  const mode: "full" | "summary" = rows.length <= RAW_ROW_LIMIT ? "full" : "summary";
  const sampleRows =
    mode === "full"
      ? rows.map(toRowPayload)
      : [...flaggedByIndex.entries()].slice(0, MAX_OUTLIER_ROWS).map(([idx]) => toRowPayload(rows[idx]));

  const userPrompt = buildUserPrompt(context, statSummary, sampleRows, mode);

  try {
    const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [ANOMALY_TOOL],
      tool_choice: { type: "tool", name: "report_anomalies" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_anomalies"
    );
    const parsed = toolUse ? parseAiAnomalies(toolUse.input) : null;

    if (!parsed) {
      console.warn("[aiAnomalyCheck] Respons Claude tidak mengandung tool_use yang valid — lanjut tanpa anomali AI.");
      return {
        anomalies: dedupeAnomalies(localAnomalies),
        summary: "Pemeriksaan AI tidak menghasilkan output valid. Data tetap tersimpan seperti biasa.",
        aiCheckSkipped: true,
      };
    }

    return {
      anomalies: dedupeAnomalies([...localAnomalies, ...parsed.anomalies]),
      summary: parsed.summary || "Pemeriksaan AI selesai, tidak ada ringkasan tambahan.",
      aiCheckSkipped: false,
    };
  } catch (err) {
    console.warn(
      "[aiAnomalyCheck] Panggilan Claude API gagal (rate limit/timeout/network) — lanjut tanpa AI check.",
      err instanceof Error ? err.message : err
    );
    return {
      anomalies: dedupeAnomalies(localAnomalies),
      summary: "Pemeriksaan AI gagal dijalankan (network/rate limit). Data tetap tersimpan seperti biasa.",
      aiCheckSkipped: true,
    };
  }
}
