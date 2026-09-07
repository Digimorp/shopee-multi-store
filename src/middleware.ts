import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const OWNER_ONLY_PREFIXES = ["/settings/users", "/settings/stores"];

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
    "/laporan-profit/:path*",
    "/retur-cancel/:path*",
    "/laporan-rekap/:path*",
    "/settings/:path*",
  ],
};
