import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef3f0",
          100: "#fee5de",
          200: "#fec8b8",
          300: "#fda283",
          400: "#fb7a50",
          500: "#f45d2e",
          600: "#e24316",
          700: "#bc3410",
          800: "#9a2e14",
          900: "#7f2b16",
        },
        accent: {
          violet: "#a78bfa",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
          sky: "#38bdf8",
        },
        surface: {
          DEFAULT: "#09090b",
          raised: "#18181b",
          overlay: "#27272a",
          border: "#3f3f46",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
