module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./game/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#050d0a", 900: "#08140f", 800: "#0d1f17", 700: "#143024", 600: "#1d4332" },
        turf: { 400: "#4fd88a", 500: "#2fbf71", 600: "#1f8f52" },
        chalk: "#f3f0e6",
        flare: { 300: "#ffd776", 400: "#ffc23d", 500: "#ffb020", 600: "#e89a00" },
        siren: { 400: "#ff7a6d", 500: "#ff5547" },
        sky: { 400: "#5cc3ff", 500: "#2fa8f5" },
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', '"Arial Narrow"', "Impact", "sans-serif"],
        sans: ["Figtree", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      keyframes: {
        pageIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        countPop: {
          "0%": { opacity: "0", transform: "scale(2.4)" },
          "25%": { opacity: "1", transform: "scale(1)" },
          "85%": { opacity: "1", transform: "scale(0.92)" },
          "100%": { opacity: "0", transform: "scale(0.6)" },
        },
        bannerIn: {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.9)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        floatY: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pageIn: "pageIn 0.35s ease-out both",
        countPop: "countPop 1s ease-in-out both",
        bannerIn: "bannerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
        pulseRing: "pulseRing 2.4s ease-out infinite",
        floatY: "floatY 3.2s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        slideDown: "slideDown 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};
