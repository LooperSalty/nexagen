import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0A0A0F",
          secondary: "#12121A",
          tertiary: "#1A1A2E",
        },
        accent: {
          primary: "#7B2FFF",
          "primary-hover": "#6A1FEE",
          secondary: "#00D4FF",
          "secondary-hover": "#00B8E0",
          tertiary: "#FF6B35",
          "tertiary-hover": "#E55A2B",
        },
        text: {
          primary: "#F0F0F5",
          secondary: "#A0A0B8",
          tertiary: "#6B6B80",
          inverse: "#0A0A0F",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.05)",
          medium: "rgba(255, 255, 255, 0.10)",
          heavy: "rgba(255, 255, 255, 0.15)",
        },
        success: "#00E676",
        warning: "#FFB300",
        error: "#FF5252",
        info: "#448AFF",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "fade-in-down": "fadeInDown 0.6s ease-out forwards",
        "slide-in-left": "slideInLeft 0.5s ease-out forwards",
        "slide-in-right": "slideInRight 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.4s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(123, 47, 255, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(123, 47, 255, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #7B2FFF 0%, #00D4FF 100%)",
        "gradient-secondary": "linear-gradient(135deg, #FF6B35 0%, #7B2FFF 100%)",
        "gradient-dark": "linear-gradient(180deg, #0A0A0F 0%, #12121A 50%, #1A1A2E 100%)",
        "gradient-radial": "radial-gradient(ellipse at center, rgba(123, 47, 255, 0.15) 0%, transparent 70%)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
