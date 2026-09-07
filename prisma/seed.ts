import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STORE_NAMES = [
  "Toko A - Elektronik",
  "Toko B - Fashion Pria",
  "Toko C - Fashion Wanita",
  "Toko D - Peralatan Rumah",
  "Toko E - Kesehatan",
  "Toko F - Kecantikan",
  "Toko G - Olahraga",
  "Toko H - Aksesoris HP",
  "Toko I - Mainan Anak",
  "Toko J - Otomotif",
  "Toko K - Dapur",
  "Toko L - Sepatu",
  "Toko M - Tas",
  "Toko N - Gadget",
];

async function main() {
  const password = await bcrypt.hash("password123", 10);

  // 14 toko
  const stores = [];
  for (let i = 0; i < STORE_NAMES.length; i++) {
    const code = `TOKO${String(i + 1).padStart(2, "0")}`;
    const store = await prisma.store.upsert({
      where: { code },
      update: {},
      create: { code, name: STORE_NAMES[i] },
    });
    stores.push(store);
  }

  // Owner / Super Admin
  await prisma.user.upsert({
    where: { email: "owner@company.com" },
    update: {},
    create: {
      name: "Owner",
      email: "owner@company.com",
      passwordHash: password,
      role: Role.OWNER,
    },
  });

  // 4 Admin Toko, masing-masing pegang ~3-4 toko
  const chunks: (typeof stores)[] = [[], [], [], []];
  stores.forEach((s, idx) => chunks[idx % 4].push(s));

  for (let i = 0; i < 4; i++) {
    const email = `admin${i + 1}@company.com`;
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `Admin Toko ${i + 1}`,
        email,
        passwordHash: password,
        role: Role.ADMIN_TOKO,
      },
    });
    for (const store of chunks[i]) {
      await prisma.userStore.upsert({
        where: { userId_storeId: { userId: admin.id, storeId: store.id } },
        update: {},
        create: { userId: admin.id, storeId: store.id },
      });
    }
  }

  // Master produk contoh — GLOBAL (berlaku semua toko)
  const sampleProducts = [
    { sku: "SKU-001", name: "Kabel Data Type-C 1m", hpp: 8000, catalogPrice: 25000 },
    { sku: "SKU-002", name: "Powerbank 10000mAh", hpp: 65000, catalogPrice: 150000 },
    { sku: "SKU-003", name: "Earphone Bluetooth TWS", hpp: 45000, catalogPrice: 120000 },
  ];
  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  await prisma.periodSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", cutoffDay: 25 },
  }).catch(async () => {
    const existing = await prisma.periodSetting.findFirst();
    if (!existing) await prisma.periodSetting.create({ data: { cutoffDay: 25 } });
  });

  console.log("Seed selesai.");
  console.log("Login Owner   : owner@company.com / password123");
  console.log("Login Admin 1 : admin1@company.com / password123 (dst. admin2-4)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
