import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";

/**
 * T-013 batch 11 (tugas U): password akun seed TIDAK boleh literal di kode.
 *
 * Urutan sumber:
 *  1. env SEED_OWNER_PASSWORD (kalau diisi);
 *  2. kunci `seed_password=` yang sudah ada di .akun-lokal.txt (supaya seed ulang tetap memakai
 *     password yang sama dengan hash yang sudah tersimpan -- seed memakai upsert update:{});
 *  3. password acak baru, DITAMBAHKAN (append) ke .akun-lokal.txt sebagai `seed_password=`.
 *     Isi file yang sudah ada tidak diubah. File itu ada di .gitignore.
 *
 * Password TIDAK PERNAH dicetak ke konsol; yang dikembalikan hanya ke pemanggil (untuk di-hash).
 */
export const SEED_PASSWORD_KEY = "seed_password";

export type SeedPasswordSource = "env" | "file" | "generated";

export function resolveSeedPassword(opts: {
  env?: Record<string, string | undefined>;
  accountFile: string;
  generate?: () => string;
}): { password: string; source: SeedPasswordSource } {
  const fromEnv = opts.env?.SEED_OWNER_PASSWORD?.trim();
  if (fromEnv) return { password: fromEnv, source: "env" };

  if (existsSync(opts.accountFile)) {
    for (const line of readFileSync(opts.accountFile, "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && line.slice(0, i).trim() === SEED_PASSWORD_KEY) {
        const v = line.slice(i + 1).trim();
        if (v) return { password: v, source: "file" };
      }
    }
  }

  const password = (opts.generate ?? (() => randomBytes(18).toString("base64url")))();
  const prefix = existsSync(opts.accountFile) && !readFileSync(opts.accountFile, "utf8").endsWith("\n") ? "\n" : "";
  appendFileSync(
    opts.accountFile,
    `${prefix}# password akun seed (prisma/seed.ts) -- dibuat otomatis, jangan di-commit\n${SEED_PASSWORD_KEY}=${password}\n`,
    "utf8"
  );
  return { password, source: "generated" };
}
