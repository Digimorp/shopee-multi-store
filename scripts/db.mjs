// Kontrol PostgreSQL portable di .localpg/ (lokal dev, tanpa install service Windows).
// Dipakai lewat: npm run db:start | db:stop | db:status | db:restart
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const binDir = join(root, ".localpg", "pgsql", "bin");
const pgCtl = join(binDir, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
const data = join(root, ".localpg", "data");
const log = join(root, ".localpg", "pg.log");
const port = process.env.PGPORT || "5432";

if (!existsSync(pgCtl) || !existsSync(data)) {
  console.error(
    "PostgreSQL portable belum tersiap di .localpg/.\n" +
      "Jalankan dulu:  npm run db:setup\n" +
      "(atau lihat README bagian 'Database lokal (PostgreSQL portable)')."
  );
  process.exit(1);
}

const action = process.argv[2];
const map = {
  start: ["-D", data, "-l", log, "-o", `-p ${port}`, "-w", "start"],
  stop: ["-D", data, "-m", "fast", "stop"],
  status: ["-D", data, "status"],
  restart: ["-D", data, "-l", log, "-o", `-p ${port}`, "-w", "-m", "fast", "restart"],
};

if (!map[action]) {
  console.error("Usage: node scripts/db.mjs <start|stop|status|restart>");
  process.exit(1);
}

const res = spawnSync(pgCtl, map[action], { stdio: "inherit" });
process.exit(res.status ?? 1);
