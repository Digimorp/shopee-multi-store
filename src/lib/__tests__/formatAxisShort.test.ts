import { describe, it, expect } from "vitest";
import { formatAxisShort } from "@/lib/format";

// T-013 butir 13: label sumbu grafik ringkas, tidak "10000k" yang terpotong.
describe("formatAxisShort", () => {
  it.each([
    [0, "0"],
    [500, "500"],
    [2_500_000, "2,5 jt"],
    [10_000_000, "10 jt"],
    [7_500_000, "7,5 jt"],
    [120_000_000, "120 jt"],
    [250_000, "250 rb"],
    [1_250_000_000, "1,3 M"],
    [-2_500_000, "-2,5 jt"],
  ])("%d -> %s", (n, s) => {
    expect(formatAxisShort(n)).toBe(s);
  });
  it("nilai tidak valid -> 0", () => {
    expect(formatAxisShort(NaN)).toBe("0");
  });
});
