import type { Config } from "tailwindcss";

// Tokens extraídos de DESIGN.md para toda a interface Luminous Vector.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        luminous: {
          surface: "#15121a", "surface-dim": "#15121a", "surface-bright": "#3c3740",
          "surface-container-lowest": "#100d14", "surface-container-low": "#1e1a22",
          "surface-container": "#221e26", "surface-container-high": "#2c2831",
          "surface-container-highest": "#37333c", "on-surface": "#e8e0eb",
          "on-surface-variant": "#cec2d5", "inverse-surface": "#e8e0eb",
          "inverse-on-surface": "#332f37", outline: "#978d9e", "outline-variant": "#4b4453",
          "surface-tint": "#d9b9ff", primary: "#9457DF", "on-primary": "#ffffff",
          "primary-container": "#56039f", "on-primary-container": "#c190ff",
          "inverse-primary": "#7a3bc4", secondary: "#d8baf9", "on-secondary": "#3c2559",
          "secondary-container": "#563e73", "on-secondary-container": "#c9acea",
          // Terciária: azul vibrante (seed #0077ff), mesmo padrão de
          // saturação/vibração que primary/secondary já usam — a versão
          // anterior (#0036ff, H227) tinha reaproveitado a saturação/
          // luminosidade da âmbar antiga, o que deixou o azul dessaturado/
          // pastel; aqui as variações são derivadas do próprio seed, sem
          // essa herança.
          tertiary: "#0077ff", "on-tertiary": "#ffffff", "tertiary-container": "#033e82",
          "on-tertiary-container": "#80bbff", error: "#ffb4ab", "on-error": "#690005",
          "error-container": "#93000a", "on-error-container": "#ffdad6",
          "primary-fixed": "#eedbff", "primary-fixed-dim": "#d9b9ff",
          "on-primary-fixed": "#2a0054", "on-primary-fixed-variant": "#611baa",
          "secondary-fixed": "#eedbff", "secondary-fixed-dim": "#d8baf9",
          "on-secondary-fixed": "#260e42", "on-secondary-fixed-variant": "#533c71",
          "tertiary-fixed": "#d6e9ff", "tertiary-fixed-dim": "#66adff",
          "on-tertiary-fixed": "#002147", "on-tertiary-fixed-variant": "#0954aa",
          background: "#15121a", "on-background": "#e8e0eb", "surface-variant": "#37333c",
        },
      },
      fontFamily: { sora: ["var(--font-sora)", "sans-serif"], inter: ["var(--font-inter)", "sans-serif"], mono: ["var(--font-jetbrains-mono)", "monospace"] },
      borderRadius: { sm: "0.25rem", DEFAULT: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem", full: "9999px" },
      spacing: { gutter: "24px", margin: "40px", "container-max": "1440px" },
      backdropBlur: { xs: "4px", sm: "10px", md: "20px", lg: "40px" },
    },
  },
  plugins: [],
};

export default config;
