// Bootstrap PostgreSQL 17 portable ke .localpg/ TANPA hak admin / tanpa Windows service.
// Sumber binary: io.zonky.test.postgres (embedded-postgres-binaries) di Maven Central.
// Idempoten: langkah yang sudah beres akan dilewati.
//
// Jalankan:  npm run db:setup
// Lanjutkan: npx prisma migrate deploy  &&  npx prisma db seed
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const PG_VERSION = "17.11.0";
const root = resolve(import.meta.dirname, "..");
const lp = join(root, ".localpg");
const tmp = join(lp, "_dl");
const pgsql = join(lp, "pgsql");
const data = join(lp, "data");
const logFile = join(lp, "pg.log");
const binExt = process.platform === "win32" ? ".exe" : "";
const arch = process.arch === "arm64" ? "arm64v8" : "amd64";
const osKey =
  process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
const jarUrl = `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-${osKey}-${arch}/${PG_VERSION}/embedded-postgres-binaries-${osKey}-${arch}-${PG_VERSION}.jar`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`\nGagal: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

// 1. Download + extract binaries (skip kalau sudah ada)
if (!existsSync(join(pgsql, "bin", `pg_ctl${binExt}`))) {
  mkdirSync(tmp, { recursive: true });
  mkdirSync(pgsql, { recursive: true });
  console.log(`> Unduh ${jarUrl}`);
  run("curl", ["-L", "-sS", "--fail", "-o", join(tmp, "pg.jar"), jarUrl]);
  run("tar", ["-xf", join(tmp, "pg.jar"), "-C", tmp]);
  const txz = readdirSync(tmp).find((f) => f.endsWith(".txz"));
  if (!txz) {
    console.error("File .txz tidak ditemukan di dalam jar.");
    process.exit(1);
  }
  run("tar", ["-xf", join(tmp, txz), "-C", pgsql]);
  rmSync(tmp, { recursive: true, force: true });
  console.log("> Binaries terpasang di .localpg/pgsql");
} else {
  console.log("> Binaries sudah ada, lewati unduh.");
}

const pgCtl = join(pgsql, "bin", `pg_ctl${binExt}`);
const postgresBin = join(pgsql, "bin", `postgres${binExt}`);

// 2. initdb + buat database aplikasi (single-user mode; Zonky tak menyertakan psql/createdb)
if (!existsSync(join(data, "PG_VERSION"))) {
  const pwfile = join(lp, "pw.tmp");
  writeFileSync(pwfile, "postgres");
  console.log("> initdb cluster baru (user: postgres / pass: postgres)");
  run(join(pgsql, "bin", `initdb${binExt}`), [
    "-D", data, "-U", "postgres", "-A", "password", `--pwfile=${pwfile}`,
    "-E", "UTF8", "--locale=C",
  ]);
  rmSync(pwfile, { force: true });

  console.log("> Buat database 'shopee_multi_store' (single-user mode)");
  const r = spawnSync(postgresBin, ["--single", "-D", data, "postgres"], {
    input: "CREATE DATABASE shopee_multi_store;\n",
    encoding: "utf8",
  });
  if (r.status !== 0 && !String(r.stderr).includes("already exists")) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
} else {
  console.log("> Cluster .localpg/data sudah ada, lewati initdb.");
}

// 3. Start server kalau belum jalan
if (spawnSync(pgCtl, ["-D", data, "status"]).status !== 0) {
  console.log("> Start server di localhost:5432");
  run(pgCtl, ["-D", data, "-l", logFile, "-o", "-p 5432", "-w", "start"]);
} else {
  console.log("> Server sudah jalan.");
}

console.log("\nSelesai. Langkah berikutnya:");
console.log("  npx prisma migrate deploy   # buat/menyamakan tabel");
console.log("  npx prisma db seed          # isi 14 toko + user awal");
console.log("\nKontrol server: npm run db:start | db:stop | db:status");
