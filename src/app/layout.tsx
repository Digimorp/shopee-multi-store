import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

// T-013 batch 17: font humanis yang nyaman dibaca lama (teks & tabel padat, punya angka tabular).
// Satu-satunya keluarga font yang dimuat.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Input & Laporan Penjualan Shopee Multi-Toko",
  description: "Management input & laporan penjualan Shopee multi-toko",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={sourceSans.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
