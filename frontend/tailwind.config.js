/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f7fb",
          100: "#e8edf6",
          200: "#d8e0ee",
          300: "#b8c5dd",
          400: "#8aa0c2",
          500: "#5b769e",
          600: "#334e6e",
          700: "#22395a",
          800: "#16294a",
          900: "#0c1c38",
          950: "#071226",
        },
        brand: {
          50: "#eefbf6",
          100: "#d5f4e7",
          200: "#aee8d2",
          300: "#79d6b8",
          400: "#46bd9b",
          500: "#2a9d7f",
          600: "#1d7d66",
          700: "#196452",
          800: "#175043",
          900: "#144239",
        },
        warn: {
          50: "#fff8e8",
          400: "#f5b33d",
          600: "#c47f11",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,18,38,0.05), 0 8px 24px rgba(7,18,38,0.06)",
        lift: "0 6px 16px rgba(7,18,38,0.10), 0 16px 40px rgba(7,18,38,0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};