import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        sand: "#f5f1e8",
        sea: "#0f766e",
        coral: "#ef6f4b",
        slate: {
          950: "#0c111d"
        }
      },
      boxShadow: {
        panel: "0 18px 45px rgba(16, 24, 40, 0.08)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 35%), radial-gradient(circle at top right, rgba(239, 111, 75, 0.16), transparent 32%)"
      }
    }
  },
  plugins: []
};

export default config;
