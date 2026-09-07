# Sistem Management Input & Laporan Penjualan Shopee Multi-Toko

Stack: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL + NextAuth.

## Fitur

- Role: Owner (akses 14 toko) & Admin Toko (akses toko yang dimapping).
- Upload & parsing laporan Shopee (xlsx/csv), auto-klasifikasi status: Cancel, Retur, Transit, Pending Settlement, Selesai.
- Perhitungan Profit HPP (Nett) & Profit Agen (harga katalog diskon 50%) per SKU.
- Dashboard: summary cards, tren omzet/profit, Top 15 produk (omzet & unit).
- Keuangan: tab Uang Cair / Mengambang / Transit.
- Retur & Cancel: action Restok Gudang / Barang Rusak (kerugian HPP).
- Laporan Rekapan: siklus cut-off 26–25, komparasi bulanan, rekap tahunan multi-toko, export Excel & PDF.
- Settings: User Management + mapping toko, Master Data Toko, Master Produk & HPP global (+import Excel), Period & Cut-Off Lock.

---

## 1. Jalankan di Lokal (via terminal / Claude Code)

Prasyarat: Node.js 18+ dan npm. **Tidak perlu install PostgreSQL** — script `db:setup` mengunduh
PostgreSQL 17 portable (binaries dari Maven Central, tanpa admin / tanpa Windows service) ke folder `.localpg/`.

```bash
# 1. Masuk ke folder project & install dependencies
cd shopee-multi-store
npm install

# 2. Environment variable
cp .env.example .env
# .env.example sudah menunjuk ke Postgres lokal (postgres:postgres@localhost:5432/shopee_multi_store).
# Ganti NEXTAUTH_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Siapkan database lokal (unduh + initdb + start server di port 5432)
npm run db:setup

# 4. Buat tabel + isi data awal (14 toko, 1 Owner, 4 Admin Toko, contoh produk)
npx prisma migrate deploy
npx prisma db seed

# 5. Jalankan aplikasi
npm run dev
```

Kontrol server DB kapan saja: `npm run db:start` · `npm run db:stop` · `npm run db:status` · `npm run db:restart`.
Server tidak auto-start saat Windows boot — jalankan `npm run db:start` sebelum `npm run dev`.

> Sudah punya PostgreSQL sendiri (service Windows, Docker, Supabase/Neon)? Lewati `db:setup`,
> cukup set `DATABASE_URL` di `.env` lalu lanjut ke langkah 4.

Buka `http://localhost:3000`. Login dengan salah satu akun hasil seed:

| Role       | Email               | Password    |
|------------|----------------------|-------------|
| Owner      | owner@company.com    | password123 |
| Admin Toko | admin1@company.com   | password123 |
| Admin Toko | admin2@company.com   | password123 |
| Admin Toko | admin3@company.com   | password123 |
| Admin Toko | admin4@company.com   | password123 |

**Ganti password default ini sebelum dipakai produksi**, lewat menu Settings > User Management.

### Format kolom file upload Shopee

Parser membaca header umum export Seller Centre Bahasa Indonesia: `No. Pesanan`, `Status Pesanan`, `Nomor Referensi SKU`/`SKU Induk`, `Nama Produk`, `Jumlah`, `Harga Setelah Diskon`, `Total Pembayaran`, `Total Penghasilan`, `Waktu Pesanan Dibuat`, `Waktu Dana Dilepaskan`. Kalau format export toko kamu beda penamaan kolom, sesuaikan daftar alias di `src/lib/parseShopee.ts` (variabel `HEADER_ALIASES`).

---

## 2. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: Sistem Input & Laporan Shopee Multi-Toko"

# Buat repo baru di GitHub dulu (lewat web atau gh cli), lalu:
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

Kalau pakai GitHub CLI:

```bash
gh repo create <nama-repo> --private --source=. --remote=origin --push
```

---

## 3. Deploy ke Vercel

Skema sudah PostgreSQL, jadi tinggal siapkan database produksi (Supabase / Neon / Vercel Postgres) —
`.localpg/` hanya untuk dev dan tidak ikut ter-deploy.

### 3.1 Siapkan database produksi (contoh Supabase)

1. Buat project baru di https://supabase.com.
2. Ambil connection string di Project Settings > Database > Connection string (pilih mode "Transaction" / pooler untuk serverless).
3. Simpan sebagai `DATABASE_URL` (dipakai di langkah 3.2 & 3.3).

### 3.2 Import project ke Vercel

1. Buka https://vercel.com/new, pilih "Import Git Repository", pilih repo yang barusan di-push.
2. Framework Preset: Next.js (otomatis terdeteksi).
3. Di bagian **Environment Variables**, tambahkan:
   - `DATABASE_URL` = connection string Postgres dari Supabase.
   - `NEXTAUTH_SECRET` = random string (jangan sama dengan lokal, generate baru).
   - `NEXTAUTH_URL` = `https://<nama-project>.vercel.app` (isi setelah tahu domain, atau update belakangan di Settings > Environment Variables lalu redeploy).
4. Klik **Deploy**.

### 3.3 Migrasi & seed database produksi

Setelah deploy pertama selesai (build akan otomatis jalankan `prisma generate`), jalankan migrasi ke database produksi dari lokal:

```bash
# di lokal, pakai DATABASE_URL produksi sementara
DATABASE_URL="<connection-string-supabase>" npx prisma migrate deploy
DATABASE_URL="<connection-string-supabase>" npm run prisma:seed
```

Atau tambahkan `prisma migrate deploy` sebagai Vercel Build Command kalau mau otomatis setiap deploy:
`Settings > General > Build & Development Settings > Build Command`:
```
prisma generate && prisma migrate deploy && next build
```

### 3.4 Selesai

Buka `https://<nama-project>.vercel.app`, login pakai akun yang sudah di-seed. Setiap push ke branch `main` akan otomatis trigger deploy baru di Vercel.

---

## Struktur Folder

```
shopee-multi-store/
├── prisma/
│   ├── schema.prisma      # Skema database (User, Store, Product, Order, dst)
│   ├── migrations/        # Riwayat migrasi (dibuat prisma migrate)
│   └── seed.ts            # Data awal: 14 toko, owner, 4 admin toko
├── scripts/
│   ├── db-setup.mjs       # Unduh + initdb PostgreSQL portable ke .localpg/
│   └── db.mjs             # start/stop/status/restart server DB lokal
├── .localpg/              # PostgreSQL portable + data (gitignored, lokal saja)
├── src/
│   ├── app/
│   │   ├── login/                # Halaman login
│   │   ├── (protected)/          # Group route yang butuh login (Sidebar + TopBar)
│   │   │   ├── dashboard/
│   │   │   ├── input/
│   │   │   ├── keuangan/
│   │   │   ├── laporan-profit/
│   │   │   ├── retur-cancel/
│   │   │   ├── laporan-rekap/
│   │   │   └── settings/{users,stores,products,periods}/
│   │   └── api/                  # Semua API route (upload, orders, reports, dst)
│   ├── components/               # TopBar, Sidebar, DataTable, TrendChart, dll
│   ├── lib/                      # prisma client, auth, rbac, parser, profit, export
│   └── middleware.ts              # Proteksi route + role guard
└── README.md
```

## Catatan Desain

- **RBAC**: Owner otomatis punya akses ke semua toko aktif. Admin Toko dibatasi lewat tabel `UserStore` (mapping banyak-ke-banyak).
- **Master Produk global**: 1 SKU = 1 HPP + 1 Harga Katalog untuk semua toko (bukan per toko). Hanya Owner yang bisa menambah/mengubah (`/settings/products`).
- **Klasifikasi status pesanan** dilakukan otomatis saat upload berdasarkan kolom "Status Pesanan" + ada/tidaknya tanggal dana dilepaskan (untuk membedakan "Selesai (cair)" vs "Sudah sampai, belum cair").
- **Profit HPP vs Profit Agen** dihitung per baris transaksi saat upload (snapshot HPP & harga katalog saat itu), supaya laporan histori tidak berubah kalau HPP di master diedit belakangan.
- **Cut-off period** (26–25) dihitung otomatis per tanggal transaksi (`src/lib/period.ts`) dan disimpan sebagai `periodKey` di setiap order, dipakai untuk rekap bulanan & lock periode.
- Export PDF di versi ini berupa ringkasan angka (bukan tabel detail per baris) untuk menjaga kesederhanaan — Export Excel menyediakan data detail lengkap.
