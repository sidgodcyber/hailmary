import type { Config } from "tailwindcss";

/**
 * Warm & friendly theme: teal primary + amber accent on a warm off-white ground,
 * rounded cards, soft shadows. Colors are also mirrored as CSS variables in
 * globals.css so non-Tailwind surfaces stay consistent.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#faf7f2",
        surface: "#ffffff",
        ink: {
          DEFAULT: "#26221d",
          muted: "#6b6357",
        },
        brand: {
          // teal
          50: "#effcf9",
          100: "#c9f5ec",
          200: "#96e8db",
          300: "#5fd6c5",
          400: "#33bcac",
          500: "#159e90",
          600: "#0d8073",
          700: "#0f665d",
          800: "#11524b",
          900: "#12443f",
        },
        accent: {
          // amber
          50: "#fff8eb",
          100: "#ffedc7",
          200: "#ffd98a",
          300: "#ffc14d",
          400: "#ffa91f",
          500: "#f59009",
          600: "#d96f04",
          700: "#b45108",
          800: "#923f0e",
          900: "#78340f",
        },
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(38,34,29,0.04), 0 6px 20px rgba(38,34,29,0.06)",
        card: "0 1px 3px rgba(38,34,29,0.06), 0 10px 30px rgba(38,34,29,0.05)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
