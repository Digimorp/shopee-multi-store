import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "Inter", "system-ui", "sans-serif"],
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
        success: { DEFAULT: "#176552", bg: "#E6EFEC", text: "#176552" },
        warning: { DEFAULT: "#E8B84A", bg: "#FBF0D9", text: "#8A6416" },
        danger: { DEFAULT: "#C06558", bg: "#F6E4E0", text: "#8F4238" },
        info: { DEFAULT: "#4F9E88", bg: "#E6F2EE", text: "#2F6A5A" },
        canvas: {
          DEFAULT: "var(--color-canvas)",
          mono: "var(--color-canvas-mono)", // latar shell monokrom (redesign murmura)
        },
        card: {
          DEFAULT: "var(--color-card)",
          border: "var(--color-card-border)",
        },
        sidebar: {
          DEFAULT: "var(--color-sidebar-bg)",
          hover: "var(--color-sidebar-hover)",
          border: "var(--color-sidebar-border)",
          text: "var(--color-sidebar-text)",
          muted: "var(--color-sidebar-muted)",
          active: "var(--color-sidebar-active)",
          activeText: "var(--color-sidebar-active-text)",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)",
        "card-lg": "0 4px 12px rgba(16,24,40,0.06), 0 16px 40px rgba(16,24,40,0.08)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
