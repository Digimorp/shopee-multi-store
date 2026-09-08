// Rename 5 akun bawaan (email + password + nama) — role & assignment toko lama
// DIPERTAHANKAN apa adanya — dan buat 1 admin baru tanpa toko.
// Idempoten (aman dijalankan ulang). Password TIDAK ditulis di file ini —
// dibaca dari env ACCOUNT_PASSWORD. Password TIDAK dicetak.
//
// Jalankan:
//   ACCOUNT_PASSWORD='<pw>' node scripts/update-accounts.mjs
//   ACCOUNT_PASSWORD='<pw>' PROD_DATABASE_URL='<neon-direct>' node scripts/update-accounts.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const PW = process.env.ACCOUNT_PASSWORD;
if (!PW) {
  console.error("Set env ACCOUNT_PASSWORD dulu.");
  process.exit(1);
}

// Email lama -> baru. Role & UserStore TIDAK disentuh.
const RENAMES = [
  { from: "owner@company.com", to: "Ownergayabebas@login", name: "Owner" },
  { from: "admin1@company.com", to: "AdminDhiyak@login", name: "Admin Dhiyak" },
  { from: "admin2@company.com", to: "AdminSandi@login", name: "Admin Sandi" },
  { from: "admin3@company.com", to: "AdminPendi@login", name: "Admin Pendi" },
  { from: "admin4@company.com", to: "AdminAslam@login", name: "Admin Aslam" },
];
const CREATES = [{ email: "AdminHusna@login", name: "Admin Husna", role: "ADMIN_TOKO" }];

async function applyTo(url, label) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const hash = await bcrypt.hash(PW, 10);
  const lines = [];
  try {
    for (const r of RENAMES) {
      const u = await db.user.findFirst({ where: { OR: [{ email: r.from }, { email: r.to }] } });
      if (!u) {
        lines.push(`SKIP  ${r.from} (tidak ditemukan)`);
        continue;
      }
      await db.user.update({ where: { id: u.id }, data: { email: r.to, name: r.name, passwordHash: hash } });
      const nToko = await db.userStore.count({ where: { userId: u.id } });
      lines.push(`OK    ${r.from.padEnd(20)} -> ${r.to.padEnd(22)} | role ${u.role} tetap | ${nToko} toko dipertahankan`);
    }
    for (const c of CREATES) {
      const exists = await db.user.findUnique({ where: { email: c.email } });
      if (exists) {
        await db.user.update({
          where: { id: exists.id },
          data: { name: c.name, role: c.role, passwordHash: hash, isActive: true },
        });
        lines.push(`OK    update ${c.email} (${c.role})`);
      } else {
        await db.user.create({ data: { email: c.email, name: c.name, role: c.role, passwordHash: hash } });
        lines.push(`OK    create ${c.email} (${c.role}, belum ada toko)`);
      }
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`[${label}]\n  ${lines.join("\n  ")}`);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set.");
  process.exit(1);
}
await applyTo(process.env.DATABASE_URL, "LOKAL");
if (process.env.PROD_DATABASE_URL) await applyTo(process.env.PROD_DATABASE_URL, "NEON (produksi)");

console.log("\nSelesai. Password sama untuk 6 akun — di-hash bcrypt(10), tidak dicetak/di-commit.");
