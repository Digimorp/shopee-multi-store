// Item 5: bikin file format export Shopee, upload lewat /api/upload (endpoint yg dipakai UI),
// lalu verifikasi klasifikasi + profit vs hitungan manual.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("file:///E:/DATA%20FILE%20SHOPEE/shopee-multi-store/package.json");
const XLSX = require("xlsx");

const BASE = "http://localhost:3000";
const jar = new Map();
const setC = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); } };
const ck = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

let r = await fetch(`${BASE}/api/auth/csrf`); setC(r);
const { csrfToken } = await r.json();
r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck() }, body: new URLSearchParams({ csrfToken, email: "owner@company.com", password: process.env.OWNER_PW, json: "true", callbackUrl: BASE }) });
setC(r);
if (!jar.has("next-auth.session-token")) { console.error("login gagal"); process.exit(1); }

const stores = (await (await fetch(`${BASE}/api/stores`, { headers: { cookie: ck() } })).json()).stores;
const toko = stores.find((s) => s.code === "TOKO01");

// ---- File format export Shopee (Seller Centre, Bahasa Indonesia) ----
// Kolom relevan + beberapa kolom "noise" yang memang ada di export asli.
const rows = [
  { "No. Pesanan": "2409150ABCD01", "Status Pesanan": "Selesai",              "Username (Pembeli)": "budi_x",  "Nomor Referensi SKU": "SKU-001", "Nama Produk": "Kabel Data Type-C 1m",     "Jumlah": 3, "Harga Awal": 30000, "Harga Setelah Diskon": 25000, "Total Pembayaran": 75000,  "Total Penghasilan": 66000,  "Biaya Administrasi": 6000,  "Nama Kurir": "JNE",   "No. Resi": "JD001", "Waktu Pesanan Dibuat": "2026-09-15 10:22", "Waktu Dana Dilepaskan": "2026-09-20 09:00" },
  { "No. Pesanan": "2409160ABCD02", "Status Pesanan": "Selesai",              "Username (Pembeli)": "sari_y",  "Nomor Referensi SKU": "SKU-002", "Nama Produk": "Powerbank 10000mAh",        "Jumlah": 1, "Harga Awal": 180000,"Harga Setelah Diskon": 150000,"Total Pembayaran": 150000, "Total Penghasilan": 138000, "Biaya Administrasi": 12000, "Nama Kurir": "SiCepat","No. Resi": "SC002", "Waktu Pesanan Dibuat": "2026-09-16 14:03", "Waktu Dana Dilepaskan": "" },
  { "No. Pesanan": "2409170ABCD03", "Status Pesanan": "Dibatalkan",           "Username (Pembeli)": "andi_z",  "Nomor Referensi SKU": "SKU-003", "Nama Produk": "Earphone Bluetooth TWS",    "Jumlah": 2, "Harga Awal": 140000,"Harga Setelah Diskon": 120000,"Total Pembayaran": 240000, "Total Penghasilan": 0,      "Biaya Administrasi": 0,     "Nama Kurir": "",      "No. Resi": "",      "Waktu Pesanan Dibuat": "2026-09-17 08:41", "Waktu Dana Dilepaskan": "" },
  { "No. Pesanan": "2409180ABCD04", "Status Pesanan": "Pengembalian Barang",  "Username (Pembeli)": "rina_a",  "Nomor Referensi SKU": "SKU-001", "Nama Produk": "Kabel Data Type-C 1m",     "Jumlah": 1, "Harga Awal": 30000, "Harga Setelah Diskon": 25000, "Total Pembayaran": 25000,  "Total Penghasilan": 0,      "Biaya Administrasi": 0,     "Nama Kurir": "JNE",   "No. Resi": "JD004", "Waktu Pesanan Dibuat": "2026-09-18 19:10", "Waktu Dana Dilepaskan": "" },
  { "No. Pesanan": "2409190ABCD05", "Status Pesanan": "Dikirim",              "Username (Pembeli)": "dodi_b",  "Nomor Referensi SKU": "SKU-002", "Nama Produk": "Powerbank 10000mAh",        "Jumlah": 2, "Harga Awal": 180000,"Harga Setelah Diskon": 150000,"Total Pembayaran": 300000, "Total Penghasilan": 276000, "Biaya Administrasi": 24000, "Nama Kurir": "J&T",   "No. Resi": "JT005", "Waktu Pesanan Dibuat": "2026-09-19 11:55", "Waktu Dana Dilepaskan": "" },
  { "No. Pesanan": "2409200ABCD06", "Status Pesanan": "Pesanan Selesai",      "Username (Pembeli)": "evi_c",   "Nomor Referensi SKU": "SKU-003", "Nama Produk": "Earphone Bluetooth TWS",    "Jumlah": 1, "Harga Awal": 140000,"Harga Setelah Diskon": 120000,"Total Pembayaran": 120000, "Total Penghasilan": 110000, "Biaya Administrasi": 10000, "Nama Kurir": "AnterAja","No. Resi": "AA006","Waktu Pesanan Dibuat": "2026-09-20 07:30", "Waktu Dana Dilepaskan": "2026-09-25 09:00" },
];
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Semua Pesanan");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
const outPath = "C:/Users/khaza/AppData/Local/Temp/claude/E--DATA-FILE-SHOPEE-shopee-multi-store/ec1a6907-5645-4bf7-9cd8-5276be444cda/scratchpad/Export-Semua-Pesanan-Shopee.xlsx";
writeFileSync(outPath, buf);
console.log("file dibuat:", outPath, `(${rows.length} baris)`);

// ---- upload lewat endpoint yang dipakai tombol UI ----
const fd = new FormData();
fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Export-Semua-Pesanan-Shopee.xlsx");
fd.append("storeId", toko.id);
const up = await (await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie: ck() }, body: fd })).json();
console.log("\n=== hasil /api/upload ===");
console.log(JSON.stringify(up, null, 1));

// ---- ambil order tersimpan, cek klasifikasi + profit per baris ----
const P = `storeId=${toko.id}&from=2026-08-26&to=2026-09-25`;
async function ordersByStatus(st) {
  return (await (await fetch(`${BASE}/api/orders?${P}&status=${st}`, { headers: { cookie: ck() } })).json()).orders ?? [];
}
const all = [];
for (const st of ["SELESAI", "PENDING_SETTLEMENT", "TRANSIT", "RETUR", "CANCEL"]) {
  for (const o of await ordersByStatus(st)) all.push(o);
}

const EXPECT = {
  "2409150ABCD01": { status: "SELESAI",            profitHpp: 66000 - 8000 * 3, profitAgen: (25000 * 0.5 - 8000) * 3, gross: 75000, net: 66000 },
  "2409160ABCD02": { status: "PENDING_SETTLEMENT", profitHpp: 0,                profitAgen: (150000 * 0.5 - 65000) * 1, gross: 150000, net: 138000 },
  "2409170ABCD03": { status: "CANCEL",             profitHpp: 0,                profitAgen: 0, gross: 0, net: 0 },
  "2409180ABCD04": { status: "RETUR",              profitHpp: 0,                profitAgen: 0, gross: 25000, net: 0 }, // Total Penghasilan=0 (dana dikembalikan) -> netSettlement 0, benar
  "2409190ABCD05": { status: "TRANSIT",            profitHpp: 0,                profitAgen: 0, gross: 300000, net: 276000 },
  "2409200ABCD06": { status: "SELESAI",            profitHpp: 110000 - 45000 * 1, profitAgen: (120000 * 0.5 - 45000) * 1, gross: 120000, net: 110000 },
};

let pass = 0, fail = 0;
console.log("\n=== verifikasi per baris (aktual vs manual) ===");
for (const o of all.sort((a, b) => a.orderSn.localeCompare(b.orderSn))) {
  const e = EXPECT[o.orderSn];
  if (!e) { console.log("  ??? order tak dikenal:", o.orderSn); fail++; continue; }
  const checks = [
    ["kategori", o.status, e.status],
    ["grossOmzet", o.grossOmzet, e.gross],
    ["netSettlement", o.netSettlement, e.net],
    ["profitHpp", o.profitHpp, e.profitHpp],
    ["profitAgen", o.profitAgen, e.profitAgen],
  ];
  const bad = checks.filter(([, a, b]) => a !== b);
  if (bad.length === 0) { pass++; console.log(`  OK  ${o.orderSn}  ${o.status}  hpp=${o.profitHpp}  agen=${o.profitAgen}`); }
  else { fail++; console.log(`  FAIL ${o.orderSn}: ` + bad.map(([k, a, b]) => `${k} aktual=${a} manual=${b}`).join(" | ")); }
}

// ---- cek agregat dashboard ----
const sum = await (await fetch(`${BASE}/api/dashboard/summary?${P}`, { headers: { cookie: ck() } })).json();
const expSum = { totalOmzetBruto: 670000, uangCair: 176000, uangMengambang: 138000, barangTransit: 276000, profitHpp: 107000, profitAgen: 38500 };
console.log("\n=== agregat dashboard/summary ===");
for (const k of Object.keys(expSum)) {
  const ok = sum[k] === expSum[k];
  console.log(`  ${ok ? "OK " : "FAIL"} ${k}: aktual=${sum[k]} manual=${expSum[k]}`);
  ok ? pass++ : fail++;
}

console.log(`\n>>> ${pass} PASS, ${fail} FAIL <<<`);
process.exit(fail ? 1 : 0);
