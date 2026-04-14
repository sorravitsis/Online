import type { Config } from "tailwindcss";
import tokens from "./design/tokens.json";

const t = tokens["SiS Warehouse"];

// Extract color scale: { "50": { value: "#..." }, ... } → { "50": "#...", ... }
function extractScale(scale: Record<string, { value: string }>) {
  return Object.fromEntries(
    Object.entries(scale).map(([k, v]) => [k, v.value])
  );
}

// Extract shadow scale: { card: { value: "..." }, ... } → { card: "...", ... }
function extractValues(obj: Record<string, { value: string }>) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v.value])
  );
}

const redScale = extractScale(t.colors.red);
const inkScale = extractScale(t.colors.ink);
const semantic = extractValues(t.colors.semantic);
const spacing = extractValues(t.spacing);
const borderRadius = extractValues(t.borderRadius);
const shadows = extractValues(t.shadows);

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: { ...redScale, DEFAULT: redScale["600"] },
          ink: { ...inkScale, DEFAULT: inkScale["900"] },
          mist: semantic.backdrop,
          green: semantic.success,
          amber: semantic.warning,
          blue: semantic.info,
          surface: semantic.surface
        }
      },
      spacing,
      borderRadius,
      boxShadow: shadows,
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        shimmer: "linear-gradient(110deg, transparent 33%, rgba(255,255,255,0.4) 50%, transparent 67%)"
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
