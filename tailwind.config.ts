import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff3ed",
          100: "#ffe4d5",
          500: "#ee4d2d",
          600: "#d8401f",
          700: "#b3301a",
        },
      },
    },
  },
  plugins: [],
};
export default config;
