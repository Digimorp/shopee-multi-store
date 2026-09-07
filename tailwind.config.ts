import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Aksen utama: pink -> purple (gaya "Lector")
        brand: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
        },
        grape: {
          400: "#a78bfa",
          500: "#a855f7",
          600: "#9333ea",
        },
        canvas: "#f8f9fc",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
        "brand-gradient-r": "linear-gradient(90deg, #ec4899 0%, #a855f7 100%)",
        "stat-pink": "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
        "stat-purple": "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
        "stat-blue": "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
        "stat-orange": "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
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
