import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { SidebarProvider } from "@/components/SidebarContext";
import { requirePageUser } from "@/lib/pageGuard";

// Semua halaman di area ini butuh sesi login & baca query param (?storeId, ?from, ?to),
// jadi selalu render dinamis — jangan di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Sesi tidak ada / user nonaktif / terhapus / token invalid -> /login (dicek di server, dari DB).
  await requirePageUser();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-canvas-mono">
        <Suspense>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col lg:pl-16">
          <Suspense>
            <TopBar />
          </Suspense>
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
