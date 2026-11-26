import { describe, it, expect, vi, beforeEach } from "vitest";

// T-013 batch 21 (bagian D): halaman /pengaturan dijaga di SERVER. Admin Toko boleh tab Toko + Produk & HPP;
// tab Owner (user / aturan / log) lewat URL langsung -> dialihkan ke /pengaturan. Tidak login -> /login.
const { requirePageUser, redirect } = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/lib/pageGuard", () => ({ requirePageUser }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/app/(protected)/pengaturan/_tabs/PengaturanTabs", () => ({ default: () => null }));

import PengaturanPage from "@/app/(protected)/pengaturan/page";

const as = (role: string) => requirePageUser.mockResolvedValue({ id: "u", name: "", email: "", role, storeIds: [] });
const open = (tab?: string) => PengaturanPage({ searchParams: tab ? { tab } : {} });

beforeEach(() => vi.clearAllMocks());

describe("/pengaturan di server", () => {
  it.each(["user", "aturan", "log"])("Admin Toko membuka ?tab=%s -> /pengaturan", async (tab) => {
    as("ADMIN_TOKO");
    await expect(open(tab)).rejects.toThrow("NEXT_REDIRECT /pengaturan");
  });
  it.each([undefined, "toko", "produk"])("Admin Toko ?tab=%s -> halaman tampil, role diteruskan", async (tab) => {
    as("ADMIN_TOKO");
    const el: any = await open(tab);
    expect(el.props).toEqual({ role: "ADMIN_TOKO" });
    expect(redirect).not.toHaveBeenCalled();
  });
  it.each(["toko", "produk", "user", "aturan", "log"])("Owner ?tab=%s -> tampil", async (tab) => {
    as("OWNER");
    const el: any = await open(tab);
    expect(el.props).toEqual({ role: "OWNER" });
  });
  it("tidak login -> /login (dari requirePageUser)", async () => {
    requirePageUser.mockImplementation(() => redirect("/login"));
    await expect(open("produk")).rejects.toThrow("NEXT_REDIRECT /login");
  });
});
