import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HppUnknownBanner, { hppUnknownProducts, type HppUnknown } from "@/components/HppUnknownBanner";

// T-013 butir 8 (batch4 I): banner "N produk tanpa HPP" sesudah upload pesanan.
const render = (h: HppUnknown | null | undefined) => renderToStaticMarkup(createElement(HppUnknownBanner, { hppUnknown: h }));

describe("HppUnknownBanner", () => {
  it("ada baris tanpa HPP -> banner amber tampil dengan jumlah produk & baris", () => {
    const html = render({
      rows: 3,
      products: 2,
      notInMaster: [{ sku: "Produk Satu", rows: 2 }],
      emptyInMaster: [{ sku: "SKU-B", rows: 1 }],
    });
    expect(html).toContain("2 produk tanpa HPP (3 baris).");
    expect(html).toContain("Profit untuk produk ini belum dihitung sampai HPP diisi di Master Produk.");
    expect(html).toContain("Produk Satu");
    expect(html).toContain("SKU-B");
    // gaya amber sama dengan TanpaHppNote
    expect(html).toContain("border-amber-200");
    expect(html).toContain("bg-amber-50");
    expect(html).toContain("text-amber-700");
  });

  it("semua punya HPP (rows 0) -> banner tidak tampil", () => {
    expect(render({ rows: 0, products: 0, notInMaster: [], emptyInMaster: [] })).toBe("");
  });

  it("respons tanpa hppUnknown (mis. upload Income Report) -> banner tidak tampil", () => {
    expect(render(undefined)).toBe("");
    expect(render(null)).toBe("");
  });

  it("respons lama tanpa field products -> jumlah produk dari panjang daftar", () => {
    expect(hppUnknownProducts({ rows: 5, notInMaster: [{ sku: "A", rows: 4 }], emptyInMaster: [{ sku: "B", rows: 1 }] })).toBe(2);
    expect(render({ rows: 5, notInMaster: [{ sku: "A", rows: 4 }], emptyInMaster: [{ sku: "B", rows: 1 }] })).toContain(
      "2 produk tanpa HPP (5 baris)."
    );
  });
});
