import { redirect } from "next/navigation";

// Selalu dinamis, jangan di-prerender saat build.
export const dynamic = "force-dynamic";

// Gerbang masuk: lempar ke /dashboard. Kalau belum login, middleware
// (matcher "/dashboard/:path*") otomatis membelokkan ke /login.
export default function RootPage() {
  redirect("/dashboard");
}
