import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

// Semua halaman di area ini butuh sesi login & baca query param (?storeId, ?from, ?to),
// jadi selalu render dinamis — jangan di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <TopBar />
        </Suspense>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
