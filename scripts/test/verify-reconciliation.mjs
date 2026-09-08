import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("file:///E:/DATA%20FILE%20SHOPEE/shopee-multi-store/package.json");
const XLSX = require("xlsx");
const BASE = "http://localhost:3000";
const OUT = "C:/Users/khaza/AppData/Local/Temp/claude/E--DATA-FILE-SHOPEE-shopee-multi-store/ec1a6907-5645-4bf7-9cd8-5276be444cda/scratchpad";
const jar = new Map();
const setC = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); } };
const ck = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
const P = "storeId=cmtqwipgg0000xvlr36a051n2&from=2026-08-01&to=2026-09-25"; // TOKO01, window lebar biar RC-C-03 (Agu) ikut

let r = await fetch(`${BASE}/api/auth/csrf`); setC(r);
const { csrfToken } = await r.json();
r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck() }, body: new URLSearchParams({ csrfToken, email: "owner@company.com", password: process.env.OWNER_PW, json: "true", callbackUrl: BASE }) });
setC(r);
if (!jar.has("next-auth.session-token")) { console.error("login gagal"); process.exit(1); }
const stores = (await (await fetch(`${BASE}/api/stores`, { headers: { cookie: ck() } })).json()).stores;
const toko = stores.find((s) => s.code === "TOKO01");

const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { cookie: ck(), ...(opts.headers || {}) } });
  const t = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
};
const upload = async (path, buf, name) => {
  const fd = new FormData();
  fd.append("file", new Blob([buf]), name);
  fd.append("storeId", toko.id);
  return api(path, { method: "POST", body: fd });
};

// ============ 1. ORDER file (format Pesanan Shopee) ============
// A,B,C = SELESAI (ada tgl dana), D = PENDING (SELESAI tanpa tgl dana), E = TRANSIT
const orderRows = [
  { "No. Pesanan": "RC-A-01", "Status Pesanan": "Selesai", "Nomor Referensi SKU": "SKU-001", "Nama Produk": "Kabel", "Jumlah": 2, "Harga Setelah Diskon": 25000, "Total Pembayaran": 50000, "Total Penghasilan": 45000, "Waktu Pesanan Dibuat": "2026-09-01", "Waktu Pesanan Selesai": "2026-09-05", "Waktu Dana Dilepaskan": "2026-09-07" }, // MATCH (income 45000)
  { "No. Pesanan": "RC-B-02", "Status Pesanan": "Selesai", "Nomor Referensi SKU": "SKU-002", "Nama Produk": "Powerbank", "Jumlah": 1, "Harga Setelah Diskon": 150000, "Total Pembayaran": 150000, "Total Penghasilan": 138000, "Waktu Pesanan Dibuat": "2026-09-02", "Waktu Pesanan Selesai": "2026-09-06", "Waktu Dana Dilepaskan": "2026-09-08" }, // MATCH (income 138003, selisih 3 <= 5)
  { "No. Pesanan": "RC-C-03", "Status Pesanan": "Selesai", "Nomor Referensi SKU": "SKU-003", "Nama Produk": "Earphone", "Jumlah": 1, "Harga Setelah Diskon": 120000, "Total Pembayaran": 120000, "Total Penghasilan": 110000, "Waktu Pesanan Dibuat": "2026-08-10", "Waktu Pesanan Selesai": "2026-08-14", "Waktu Dana Dilepaskan": "2026-08-16" }, // SELISIH (income 95000, beda 15000) + tgl lama -> CAIR_FINAL
  { "No. Pesanan": "RC-D-04", "Status Pesanan": "Selesai", "Nomor Referensi SKU": "SKU-001", "Nama Produk": "Kabel", "Jumlah": 3, "Harga Setelah Diskon": 25000, "Total Pembayaran": 75000, "Total Penghasilan": 67000, "Waktu Pesanan Dibuat": "2026-09-03", "Waktu Pesanan Selesai": "", "Waktu Dana Dilepaskan": "" }, // PENDING, tak ada income -> BELUM_KETEMU, MENUNGGU_CAIR
  { "No. Pesanan": "RC-E-05", "Status Pesanan": "Dikirim", "Nomor Referensi SKU": "SKU-002", "Nama Produk": "Powerbank", "Jumlah": 2, "Harga Setelah Diskon": 150000, "Total Pembayaran": 300000, "Total Penghasilan": 276000, "Waktu Pesanan Dibuat": "2026-09-01", "Waktu Pesanan Selesai": "", "Waktu Dana Dilepaskan": "" }, // TRANSIT, dibuat 8 Sep tapi >7hr? dibuat 1 Sep -> flag SAMPAI_7H
];
const ws1 = XLSX.utils.json_to_sheet(orderRows);
const wb1 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb1, ws1, "Pesanan");
console.log("upload Pesanan:", JSON.stringify(await upload("/api/upload", XLSX.write(wb1, { type: "buffer", bookType: "xlsx" }), "Pesanan-TOKO01.xlsx")));

// ============ 2. INCOME REPORT file (format Laporan Pendapatan Shopee) ============
// blok judul 2 baris di atas header (uji deteksi header tidak di baris 1)
const incomeAoa = [
  ["Laporan Pendapatan - Rilis Dana", "", "", "", ""],
  ["Toko: Toko A - Elektronik", "Periode: 01 Agu 2026 - 25 Sep 2026", "", "", ""],
  ["No. Pesanan", "Jenis Transaksi", "Deskripsi", "Tanggal Dana Dilepaskan", "Total Penghasilan"],
  ["RC-A-01", "Order", "Kabel", "2026-09-07", 45000],                 // MATCH
  ["RC-B-02", "Order", "Powerbank", "2026-09-08", 138003],            // MATCH (selisih 3)
  ["RC-C-03", "Order", "Earphone", "2026-08-16", 95000],              // SELISIH (beda 15.000)
  ["RC-Z-99", "Order", "Order tidak ada di DB", "2026-09-10", 52000], // BELUM_KETEMU sisi income
  ["", "Kompensasi", "Kompensasi keterlambatan pengiriman COD", "2026-09-09", 12000],
  ["", "Sengketa", "Refund sengketa produk rusak", "2026-09-11", -30000],
  ["", "Reimbursement Promo", "Ganti rugi promo Gratis Ongkir Shopee", "2026-09-12", 8500],
  ["Total", "", "", "", 344003], // baris ringkasan -> harus di-skip
];
const ws2 = XLSX.utils.aoa_to_sheet(incomeAoa);
const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, ws2, "Income");
const incomeBuf = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
writeFileSync(`${OUT}/Income-Report-TOKO01-contoh.xlsx`, incomeBuf);
console.log("upload Income Report:", JSON.stringify(await upload("/api/income/import", incomeBuf, "Income-Report-TOKO01.xlsx")));

// ============ 3. RECONCILIATION ============
const rec = await api(`/api/reconciliation?${P}`);
console.log("\n=== rate ===", JSON.stringify(rec.rate));
console.log("=== totals ===", JSON.stringify(rec.totals));
console.log("=== items ===");
for (const it of rec.items) console.log(`  ${it.orderSn.padEnd(8)} est=${it.estimasi} akt=${it.aktual}  sel=${it.selisih}  [${it.category}/${it.side}]  ${it.stage}  ${it.flags.join(",")}`);
console.log("=== adjustments ===");
for (const a of rec.adjustments) console.log(`  ${a.kind.padEnd(20)} ${a.amount}  ${a.description}`);

// assertions
const by = Object.fromEntries(rec.items.map((i) => [i.orderSn, i]));
let fail = 0;
const chk = (name, cond) => { console.log(`  ${cond ? "OK " : "FAIL"} ${name}`); if (!cond) fail++; };
console.log("\n=== cek ===");
chk("RC-A-01 MATCH", by["RC-A-01"]?.category === "MATCH");
chk("RC-B-02 MATCH (selisih 3 <= 5)", by["RC-B-02"]?.category === "MATCH" && by["RC-B-02"]?.selisih === 3);
chk("RC-C-03 SELISIH (beda 15rb)", by["RC-C-03"]?.category === "SELISIH" && by["RC-C-03"]?.selisih === -15000);
chk("RC-C-03 stage CAIR_FINAL (tgl Agu, > H+14)", by["RC-C-03"]?.stage === "CAIR_FINAL");
chk("RC-D-04 BELUM_KETEMU sisi order", by["RC-D-04"]?.category === "BELUM_KETEMU" && by["RC-D-04"]?.side === "order");
chk("RC-D-04 stage MENUNGGU_CAIR", by["RC-D-04"]?.stage === "MENUNGGU_CAIR");
chk("RC-E-05 kategori N/A (TRANSIT, belum jatuh tempo)", by["RC-E-05"]?.category === "N/A");
chk("RC-E-05 stage SAMPAI + flag 7 hari", by["RC-E-05"]?.stage === "SAMPAI" && by["RC-E-05"]?.flags.includes("SAMPAI_7H_BELUM_CAIR"));
chk("RC-Z-99 BELUM_KETEMU sisi income", by["RC-Z-99"]?.category === "BELUM_KETEMU" && by["RC-Z-99"]?.side === "income");
chk("3 adjustment (kompensasi/sengketa/reimbursement)", rec.adjustments.length === 3);
chk("adjustment total = 12000 - 30000 + 8500 = -9500", rec.totals.adjustment === -9500);
chk("rate.match = 2", rec.rate.match === 2);
chk("rate.selisih = 1", rec.rate.selisih === 1);
chk("rate.belumKetemu = 2 (RC-D-04 + RC-Z-99)", rec.rate.belumKetemu === 2);
chk("rate.total = 5 (N/A tidak dihitung)", rec.rate.total === 5);
chk("rate.matchPct = 0.4", Math.abs(rec.rate.matchPct - 0.4) < 1e-9);

// ============ 4. RE-IMPORT periode sama -> versioning ============
const re = await upload("/api/income/import", incomeBuf, "Income-Report-TOKO01-resync.xlsx");
console.log("\n=== re-import (periode sama) ===", JSON.stringify(re));
chk("re-import version = 2", re.version === 2);
chk("re-import supersededCount = 1", re.supersededCount === 1);
const imps = (await api(`/api/income/imports?storeId=${toko.id}`)).imports;
chk("2 import tercatat", imps.length === 2);
chk("hanya 1 aktif (non-superseded)", imps.filter((i) => !i.isSuperseded).length === 1);
const rec2 = await api(`/api/reconciliation?${P}`);
chk("setelah re-import: rate.match tetap 2 (tidak double)", rec2.rate.match === 2);
chk("setelah re-import: adjustment tetap 3 (tidak double)", rec2.adjustments.length === 3);

console.log(fail ? `\n>>> ${fail} FAIL <<<` : "\n>>> SEMUA LOLOS <<<");
process.exit(fail ? 1 : 0);
