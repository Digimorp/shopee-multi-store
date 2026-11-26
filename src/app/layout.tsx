import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

// T-013 batch 19: Plus Jakarta Sans (lebar, terbuka, ramah). Satu-satunya keluarga font yang dimuat.
// Bobot 400 (isi), 500, 600 (label/sub-judul), 700 (judul) -- font ini punya semuanya.
const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Input & Laporan Penjualan Shopee Multi-Toko",
  description: "Management input & laporan penjualan Shopee multi-toko",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={fontSans.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
