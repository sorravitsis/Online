import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary red scale — from subtle tint to deep
          red: {
            50: "#fef2f2",
            100: "#fee2e2",
            200: "#fecaca",
            300: "#fca5a5",
            400: "#f87171",
            500: "#ef4444",
            600: "#dc2626",
            700: "#b91c1c",
            800: "#991b1b",
            900: "#7f1d1d",
            950: "#450a0a",
            DEFAULT: "#dc2626"
          },
          // Neutral ink scale
          ink: {
            50: "#f8fafc",
            100: "#f1f5f9",
            200: "#e2e8f0",
            300: "#cbd5e1",
            400: "#94a3b8",
            500: "#64748b",
            600: "#475569",
            700: "#334155",
            800: "#1e293b",
            900: "#0f172a",
            950: "#020617",
            DEFAULT: "#0f172a"
          },
          // Semantic
          mist: "#f8fafc",
          steel: "#334155",
          amber: "#f59e0b",
          green: "#15803d",
          blue: "#2563eb"
        }
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 4px 14px -2px rgba(15, 23, 42, 0.05)",
        "card-hover": "0 4px 20px -4px rgba(15, 23, 42, 0.08), 0 8px 28px -6px rgba(15, 23, 42, 0.06)",
        "elevated": "0 8px 32px -8px rgba(220, 38, 38, 0.12), 0 16px 48px -12px rgba(15, 23, 42, 0.08)",
        "glow-red": "0 0 24px -4px rgba(220, 38, 38, 0.2)",
        "inner-glow": "inset 0 1px 2px 0 rgba(255, 255, 255, 0.8)"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "shimmer": "linear-gradient(110deg, transparent 33%, rgba(255,255,255,0.4) 50%, transparent 67%)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        shimmer: "shimmer 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
