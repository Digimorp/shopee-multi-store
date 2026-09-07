// Reset password akun bawaan (owner + admin1..4) ke password acak kuat 16 karakter.
// TIDAK menyentuh data lain. Tidak menyimpan password ke file / git — hanya dicetak ke stdout.
//
// Jalankan:
//   node scripts/reset-passwords.mjs                       # target: DATABASE_URL
//   PROD_DATABASE_URL="<neon>" node scripts/reset-passwords.mjs   # target: DATABASE_URL + Neon (password sama)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const EMAILS = [
  "owner@company.com",
  "admin1@company.com",
  "admin2@company.com",
  "admin3@company.com",
  "admin4@company.com",
];

const SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ", // tanpa I,O
  "abcdefghijkmnopqrstuvwxyz", // tanpa l
  "23456789", // tanpa 0,1
  "!@#$%^&*-_=+?",
];

function genPassword(len = 16) {
  const all = SETS.join("");
  const chars = SETS.map((s) => s[randomInt(s.length)]); // minimal 1 dari tiap set
  while (chars.length < len) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function applyTo(url, label, plainByEmail) {
  const client = new PrismaClient({ datasources: { db: { url } } });
  const out = [];
  try {
    for (const [email, pw] of Object.entries(plainByEmail)) {
      const passwordHash = await bcrypt.hash(pw, 10);
      try {
        await client.user.update({ where: { email }, data: { passwordHash } });
        out.push(`  OK   ${email}`);
      } catch (e) {
        out.push(`  SKIP ${email} (${e.code || e.message})`);
      }
    }
  } finally {
    await client.$disconnect();
  }
  console.log(`[${label}]\n${out.join("\n")}`);
}

const plain = Object.fromEntries(EMAILS.map((e) => [e, genPassword(16)]));

const localUrl = process.env.DATABASE_URL;
if (!localUrl) {
  console.error("DATABASE_URL belum di-set.");
  process.exit(1);
}
await applyTo(localUrl, "LOKAL", plain);
if (process.env.PROD_DATABASE_URL) {
  await applyTo(process.env.PROD_DATABASE_URL, "NEON (produksi)", plain);
}

console.log("\n=================== PASSWORD BARU — CATAT SEKARANG ===================");
for (const [email, pw] of Object.entries(plain)) {
  console.log(`${email.padEnd(22)}  ${pw}`);
}
console.log("====================================================================");
console.log("Password ini TIDAK disimpan di file / git. Bisa diganti lagi lewat Settings > User Management.");
