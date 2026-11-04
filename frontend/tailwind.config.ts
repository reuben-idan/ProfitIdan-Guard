import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10231b",
        pine: {
          50: "#eef6f1",
          100: "#d9e9df",
          200: "#b2d3c1",
          600: "#1c6a4c",
          700: "#14573e",
          800: "#0e4a34",
          900: "#083527",
          950: "#052a1f",
        },
        gold: {
          100: "#f8ecd2",
          700: "#9a6206",
          800: "#7c4f08",
        },
        mist: "#edf1ee",
        clay: "#b3261e",
      },
      fontFamily: {
        sans: ['"Avenir Next"', '"Segoe UI"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"Iowan Old Style"', "Georgia", '"Times New Roman"', "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 35 27 / 0.06), 0 12px 28px -20px rgb(16 35 27 / 0.35)",
        pop: "0 2px 6px rgb(16 35 27 / 0.10), 0 20px 44px -24px rgb(8 53 39 / 0.45)",
        glow: "0 0 0 1px rgb(255 255 255 / 0.12), 0 8px 40px -8px rgb(28 106 76 / 0.55)",
        gold: "0 0 0 1px rgb(248 236 210 / 0.25), 0 8px 32px -10px rgb(154 98 6 / 0.5)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.45s ease-out both",
        sweep: "sweep 1.4s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        pulseGlow: "pulseGlow 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
