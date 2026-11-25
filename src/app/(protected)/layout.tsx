import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { requirePageUser } from "@/lib/pageGuard";

// Semua halaman di area ini butuh sesi login & baca query param (?storeId, ?from, ?to),
// jadi selalu render dinamis — jangan di-prerender statis saat build.
export const dynamic = "force-dynamic";

// T-013 batch 18 (Kaca Lembut): latar gradasi dari body (globals.css). Rel kiri = kapsul melayang
// (>= 820px); di bawah 820px rel disembunyikan dan menu cukup lewat pil atas yang bisa digeser.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Sesi tidak ada / user nonaktif / terhapus / token invalid -> /login (dicek di server, dari DB).
  await requirePageUser();
  return (
    <div className="min-h-screen">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col min-[820px]:pl-[84px]">
        <Suspense>
          <TopBar />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 pb-12 pt-2 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
