/**
 * T-013 butir 19 — CEK READ-ONLY (dry-run): berapa baris pesanan yang Order.periodKey tersimpannya
 * berbeda dari periode cut-off yang dihitung dalam WIB (getPeriodForDateWib, sumber yang sama dengan
 * upload, kunci periode, dan Rekap). Skrip ini TIDAK menulis apa pun ke DB.
 *
 * Pemakaian (DB LOKAL saja):  npx tsx scripts/cek-periodkey.ts
 * Pengaman: berhenti kalau DATABASE_URL bukan localhost / 127.0.0.1 (mis. Neon).
 */
import { PrismaClient } from "@prisma/client";
import { getPeriodForDateWib } from "../src/lib/period";

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* url kosong / tidak valid */
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    console.error("BERHENTI: DATABASE_URL bukan DB lokal. Skrip ini hanya untuk DB lokal (tidak untuk Neon).");
    process.exit(1);
  }
}

async function main() {
  assertLocalDb();
  const prisma = new PrismaClient();
  try {
    const setting = await prisma.periodSetting.findFirst();
    const cutoffDay = setting?.cutoffDay ?? 25;
    const orders = await prisma.order.findMany({
      select: { periodKey: true, orderCreatedAt: true, deletedAt: true },
    });

    let aktif = 0;
    let beda = 0;
    let bedaTerhapus = 0;
    const perPeriodeWib = new Map<string, { total: number; beda: number }>();
    const pasangan = new Map<string, number>(); // "tersimpan -> WIB"
    for (const o of orders) {
      const wibKey = getPeriodForDateWib(o.orderCreatedAt, cutoffDay).key;
      const salah = o.periodKey !== wibKey;
      if (o.deletedAt) {
        if (salah) bedaTerhapus++;
        continue;
      }
      aktif++;
      const p = perPeriodeWib.get(wibKey) ?? { total: 0, beda: 0 };
      p.total++;
      if (salah) {
        p.beda++;
        beda++;
        const k = `${o.periodKey} -> ${wibKey}`;
        pasangan.set(k, (pasangan.get(k) ?? 0) + 1);
      }
      perPeriodeWib.set(wibKey, p);
    }

    console.log(`cutoffDay=${cutoffDay} | pesanan aktif=${aktif} | periodKey beda dari WIB=${beda} | (terhapus & beda=${bedaTerhapus})`);
    for (const [k, v] of [...perPeriodeWib].sort()) console.log(`  periode WIB ${k}: ${v.beda} dari ${v.total} baris beda`);
    for (const [k, v] of [...pasangan].sort()) console.log(`  tersimpan ${k}: ${v} baris`);

    // Kunci periode: key yang tidak sama dengan key periode WIB mana pun tidak akan pernah cocok saat upload.
    const locks = await prisma.periodLock.findMany({ select: { periodKey: true, locked: true } });
    const invalid = locks.filter((l) => {
      const to = l.periodKey.split("_")[1];
      if (!to) return true;
      return getPeriodForDateWib(new Date(`${to}T12:00:00+07:00`), cutoffDay).key !== l.periodKey;
    });
    console.log(`kunci periode: ${locks.length} baris (${locks.filter((l) => l.locked).length} terkunci), key tidak cocok periode WIB=${invalid.length}`);
    for (const l of invalid) console.log(`  key tidak cocok: ${l.periodKey} (locked=${l.locked})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
