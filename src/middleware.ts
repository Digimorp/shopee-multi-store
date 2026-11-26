import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// T-013 batch 15: /settings/* lama tetap dijaga (kini redirect).
// T-013 batch 21: /pengaturan dibuka untuk Admin Toko (tab Toko + Produk & HPP); tab Owner dijaga di
// halaman /pengaturan (server, role dari DB) -- bukan di sini, karena tab ada di query (?tab=).
const OWNER_ONLY_PREFIXES = [
  "/settings/users",
  "/settings/stores",
  "/settings/products",
  "/settings/status-mapping",
  "/settings/periods",
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const path = req.nextUrl.pathname;

    if (OWNER_ONLY_PREFIXES.some((p) => path.startsWith(p)) && token?.role !== "OWNER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/input/:path*",
    "/keuangan/:path*",
    "/rekonsiliasi/:path*",
    "/laporan-profit/:path*",
    "/laporan-barang-keluar/:path*",
    "/performa-toko/:path*",
    "/retur-cancel/:path*",
    "/laporan-rekap/:path*",
    "/settings/:path*",
    "/on-proses/:path*",
    "/bulanan/:path*",
    "/pengaturan/:path*",
  ],
};
