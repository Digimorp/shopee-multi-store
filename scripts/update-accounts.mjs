// Rename 5 akun bawaan (email + password + nama) — role & assignment toko lama
// DIPERTAHANKAN apa adanya — dan buat 1 admin baru tanpa toko.
// Idempoten (aman dijalankan ulang). Email Owner & password TIDAK ditulis di file ini (T-013
// batch 11) -- dibaca dari env. Password TIDAK dicetak.
//
// Jalankan (DB LOKAL; isi nilai sendiri, jangan di-commit):
//   ACCOUNT_OWNER_EMAIL=<email-owner> ACCOUNT_OWNER_PASSWORD=<password-owner> //   ACCOUNT_ADMIN_PASSWORD=<password-admin> DATABASE_URL=<url-db-lokal> node scripts/update-accounts.mjs
// DB selain localhost (termasuk PROD_DATABASE_URL) DITOLAK, kecuali flag eksplisit --allow-remote.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ---- Semua pengecekan di bawah ini jalan SEBELUM koneksi DB apa pun dibuat.
const OWNER_EMAIL = process.env.ACCOUNT_OWNER_EMAIL?.trim();
const OWNER_PW = process.env.ACCOUNT_OWNER_PASSWORD;
const ADMIN_PW = process.env.ACCOUNT_ADMIN_PASSWORD;
const missing = [
  !OWNER_EMAIL && "ACCOUNT_OWNER_EMAIL",
  !OWNER_PW && "ACCOUNT_OWNER_PASSWORD",
  !ADMIN_PW && "ACCOUNT_ADMIN_PASSWORD",
].filter(Boolean);
if (missing.length) {
  console.error(`BERHENTI: isi variabel lingkungan ${missing.join(", ")} (DB belum disentuh).`);
  process.exit(1);
}
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const isLocalUrl = (url) => {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};
if (!process.env.DATABASE_URL) {
  console.error("BERHENTI: DATABASE_URL belum di-set (DB belum disentuh).");
  process.exit(1);
}
for (const [name, url] of [["DATABASE_URL", process.env.DATABASE_URL], ["PROD_DATABASE_URL", process.env.PROD_DATABASE_URL]]) {
  if (url && !isLocalUrl(url) && !ALLOW_REMOTE) {
    console.error(`BERHENTI: ${name} bukan localhost. Script ini hanya untuk DB lokal; pakai --allow-remote kalau memang disengaja (DB belum disentuh).`);
    process.exit(1);
  }
}
// Email lama -> baru (akun admin). Role & UserStore TIDAK disentuh. Owner ditangani terpisah
// (email dari env ACCOUNT_OWNER_EMAIL), tidak ada email Owner di file ini.
const RENAMES = [
  { from: "admin1@company.com", to: "AdminDhiyak@login", name: "Admin Dhiyak" },
  { from: "admin2@company.com", to: "AdminSandi@login", name: "Admin Sandi" },
  { from: "admin3@company.com", to: "AdminPendi@login", name: "Admin Pendi" },
  { from: "admin4@company.com", to: "AdminAslam@login", name: "Admin Aslam" },
];
const CREATES = [{ email: "AdminHusna@login", name: "Admin Husna", role: "ADMIN_TOKO" }];

async function applyTo(url, label) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const hash = await bcrypt.hash(ADMIN_PW, 10);
  const ownerHash = await bcrypt.hash(OWNER_PW, 10);
  const lines = [];
  try {
    // Owner: akun dengan email ACCOUNT_OWNER_EMAIL; kalau belum ada, Owner pertama (role OWNER).
    const owner =
      (await db.user.findUnique({ where: { email: OWNER_EMAIL } })) ??
      (await db.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } }));
    if (!owner) {
      lines.push("SKIP  Owner (tidak ditemukan)");
    } else {
      await db.user.update({ where: { id: owner.id }, data: { email: OWNER_EMAIL, name: "Owner", passwordHash: ownerHash } });
      lines.push(`OK    Owner -> ${OWNER_EMAIL} | role ${owner.role} tetap`);
    }
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

await applyTo(process.env.DATABASE_URL, "LOKAL");
if (process.env.PROD_DATABASE_URL) await applyTo(process.env.PROD_DATABASE_URL, "NEON (produksi)");

console.log("\nSelesai. Password sama untuk 6 akun — di-hash bcrypt(10), tidak dicetak/di-commit.");
