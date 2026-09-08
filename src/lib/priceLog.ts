import { prisma } from "@/lib/prisma";

type ExistingProduct = { id: string; sku: string; name: string; hpp: number; catalogPrice: number } | null;

/**
 * Catat audit log kalau HPP dan/atau Harga Katalog produk berubah.
 * Produk baru (existing null) atau nilai tidak berubah -> tidak dicatat.
 */
export async function logPriceChangeIfNeeded(opts: {
  existing: ExistingProduct;
  newHpp: number;
  newCatalog: number;
  changedById: string;
  source: "manual" | "import";
}): Promise<boolean> {
  const { existing, newHpp, newCatalog, changedById, source } = opts;
  if (!existing) return false;
  if (existing.hpp === newHpp && existing.catalogPrice === newCatalog) return false;

  await prisma.productPriceLog.create({
    data: {
      productId: existing.id,
      sku: existing.sku,
      name: existing.name,
      oldHpp: existing.hpp,
      newHpp,
      oldCatalog: existing.catalogPrice,
      newCatalog,
      source,
      changedById,
    },
  });
  return true;
}
