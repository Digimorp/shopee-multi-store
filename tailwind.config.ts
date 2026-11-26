import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // T-013 batch 19: Plus Jakarta Sans = satu-satunya sans. Cadangan: font sistem.
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      // Aturan baca batch 17: tidak ada teks di bawah 13px; teks isi/tabel 15px; dasar 16px; line-height 1.5.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.5" }], // 13px -- label kecil (minimum)
        sm: ["0.9375rem", { lineHeight: "1.5" }], // 15px -- teks isi padat & tabel
        base: ["1rem", { lineHeight: "1.5" }], // 16px -- teks isi
      },
      colors: {
        // Aksen utama: hijau tua/forest green — dipakai tombol, link, focus ring, hover.
        brand: {
          50: "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
        },
        // Aksen kedua (muted plum) — dipakai seperlunya utk variasi kecil (icon badge, chart).
        grape: {
          400: "var(--color-grape-400)",
          500: "var(--color-grape-500)",
          600: "var(--color-grape-600)",
        },
        // Palet status/badge/notifikasi (earth-tone). Dipakai LEWAT TOKEN ini, jangan hardcode hex di komponen.
        //  - DEFAULT = warna solid (isi badge solid, titik, ikon, border)
        //  - bg      = latar badge "soft"
        //  - text    = teks di atas bg soft, atau angka berwarna di atas putih (kontras >= 4,7:1)
        // Catatan: teks di atas DEFAULT solid — putih utk success/danger, gelap (neutral-900) utk warning
        // karena kuning mustard + putih hanya ~1,8:1.
        // T-013 batch 18 (gaya Kaca Lembut): warna status disamakan dengan palet baru. `text` dipilih
        // supaya >= 4,5:1 di atas kartu kaca/putih DAN di atas latar `bg`-nya sendiri.
        success: { DEFAULT: "#128A5B", bg: "#E3F2EC", text: "#0F7A50" },
        warning: { DEFAULT: "#E8B84A", bg: "#FBF0D9", text: "#8A6416" },
        danger: { DEFAULT: "#D6453D", bg: "#FBE7E5", text: "#B8352E" },
        info: { DEFAULT: "#17A398", bg: "#E3F4F3", text: "#0B6F67" },
        // Teks utama / sekunder. muted #667180 = 4,8-5:1 di atas kartu kaca/putih. Teks yang duduk
        // LANGSUNG di atas latar gradasi memakai muted-deep (#5F6977, >= 4,8:1) karena #667180 di
        // gradasi hanya 4,3:1.
        ink: "#10141A",
        muted: { DEFAULT: "#667180", deep: "#5F6977" },
        // Aksen teal + aksen kedua ungu. accent.text = teal gelap untuk teks (teal #17A398 hanya 3:1).
        accent: { DEFAULT: "#17A398", soft: "#E3F4F3", text: "#0B6F67" },
        accent2: "#8B7CF6",
        // Tombol utama & menu aktif: pil hitam.
        pill: "#0B0D10",
        sidebar: {
          DEFAULT: "var(--color-sidebar-bg)",
          hover: "var(--color-sidebar-hover)",
          text: "var(--color-sidebar-text)",
          active: "var(--color-sidebar-active)",
          activeText: "var(--color-sidebar-active-text)",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)",
        "card-lg": "0 4px 12px rgba(16,24,40,0.06), 0 16px 40px rgba(16,24,40,0.08)",
        glass: "0 8px 30px rgba(40,60,90,0.08)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        glass: "22px",
      },
    },
  },
  plugins: [],
};
export default config;
