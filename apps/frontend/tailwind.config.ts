import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c0d2ff",
          300: "#93b0ff",
          400: "#6080ff",
          500: "#3b5bdb",  // primary
          600: "#2f4ac7",
          700: "#2340b0",
          800: "#1a318e",
          900: "#122470",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f8f9fa",
          muted:  "#e9ecef",
        },
        text: {
          primary:   "#1a1a2e",
          secondary: "#495057",
          muted:     "#868e96",
          inverse:   "#ffffff",
        },
        success: { DEFAULT: "#2f9e44", light: "#d3f9d8" },
        warning: { DEFAULT: "#e67700", light: "#fff3bf" },
        error:   { DEFAULT: "#c92a2a", light: "#ffe3e3" },
        info:    { DEFAULT: "#1971c2", light: "#d0ebff" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        xs:   ["0.75rem",  { lineHeight: "1rem" }],
        sm:   ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem",     { lineHeight: "1.5rem" }],
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
        "2xl":["1.5rem",   { lineHeight: "2rem" }],
        "3xl":["1.875rem", { lineHeight: "2.25rem" }],
        "4xl":["2.25rem",  { lineHeight: "2.5rem" }],
      },
      spacing: {
        "4.5": "1.125rem",
        "13":  "3.25rem",
        "18":  "4.5rem",
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        sm:      "0.25rem",
        md:      "0.375rem",
        lg:      "0.5rem",
        xl:      "0.75rem",
        "2xl":   "1rem",
        full:    "9999px",
      },
      boxShadow: {
        sm:  "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md:  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg:  "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl:  "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      },
      screens: {
        xs:  "475px",
        sm:  "640px",
        md:  "768px",
        lg:  "1024px",
        xl:  "1280px",
        "2xl": "1536px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast:    "100ms",
        slow:    "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
