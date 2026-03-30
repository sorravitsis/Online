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
          ink: "#0f172a",
          mist: "#f8fafc",
          steel: "#334155",
          amber: "#f59e0b",
          green: "#15803d",
          blue: "#2563eb",
          red: "#dc2626"
        }
      }
    }
  },
  plugins: []
};

export default config;
