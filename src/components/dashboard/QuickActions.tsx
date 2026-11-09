"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { formatNumber } from "@/lib/format";

function selisihText(count?: number) {
  if (count === undefined) return "Pesanan selisih perlu dicek";
  return count > 0 ? `${formatNumber(count)} pesanan selisih perlu dicek` : "Tidak ada selisih perlu dicek";
}

// Baris pintasan Dashboard. Filter toko & periode aktif ikut dibawa ke halaman tujuan.
export default function QuickActions({ selisihCount }: { selisihCount?: number }) {
  const searchParams = useSearchParams();

  const hrefTo = (path: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(extra ?? {}).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const items: { href: string; icon: IconName; title: string; description: string }[] = [
    { href: hrefTo("/input"), icon: "box", title: "Lihat Order", description: "Impor & kelola data pesanan" },
    {
      href: hrefTo("/rekonsiliasi", { reconTab: "SELISIH" }),
      icon: "scale",
      title: "Butuh Perhatian",
      description: selisihText(selisihCount),
    },
    { href: hrefTo("/laporan-profit"), icon: "fileText", title: "Laporan", description: "Profit & barang keluar" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.title}
          href={item.href}
          className="card flex items-center gap-4 p-6 transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600">
            <Icon name={item.icon} size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">{item.title}</span>
            <span className="block text-xs text-gray-500">{item.description}</span>
          </span>
          <Icon name="arrowRight" size={16} className="shrink-0 text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
