/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F3EE",
        ink: "#252332",
        coal: "#171717",
        muted: "#777487",
        lavender: "#F0EAF8",
        skysoft: "#EAF2FC",
        mint: "#E7F4EC",
        pinksoft: "#F8E8F1",
        cream: "#FBF7EE",
        line: "#E7E0EB",
        accent: "#0E7C6B",
        accentdark: "#075A53",
        deepgreen: "#063F3C",
      },
      borderRadius: {
        card: "1.25rem",
        pill: "9999px",
      },
      borderColor: {
        DEFAULT: "#E7E0EB",
      },
      boxShadow: {
        card: "0 1px 2px rgba(37,35,50,.05), 0 8px 24px -12px rgba(37,35,50,.07)",
        lift: "0 2px 4px rgba(37,35,50,.06), 0 16px 32px -12px rgba(37,35,50,.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
