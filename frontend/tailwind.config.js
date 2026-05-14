/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Fondos oscuros UMSA ─────────────────────────────
        "app-bg":      "#080e17",
        "app-surface": "#0d1520",
        "app-panel":   "#111b28",
        "app-card":    "#162032",
        "app-hover":   "#1a2640",
        "app-border":  "#1e2e42",
        "app-border2": "#243550",

        // ── Modo claro ──────────────────────────────────────
        "lt-bg":      "#f0f4f8",
        "lt-surface": "#ffffff",
        "lt-panel":   "#f7fafc",
        "lt-card":    "#eef2f7",
        "lt-hover":   "#e2e8f0",
        "lt-border":  "#cbd5e1",
        "lt-text":    "#0f172a",
        "lt-muted":   "#64748b",

        // ── Texto ───────────────────────────────────────────
        "tx-primary": "#e8edf5",
        "tx-muted":   "#5a7a9a",
        "tx-dim":     "#3a5570",

        // ── Acento verde UMSA ───────────────────────────────
        "accent":       "#4ade80",
        "accent-dark":  "#22c55e",
        "accent-dim":   "#16a34a",
        "accent-glow":  "rgba(74,222,128,0.12)",
        "accent-faint": "rgba(74,222,128,0.06)",

        // ── Acento teal (KI / Asistente General) ────────────
        "teal":       "#6bbbae",
        "teal-dark":  "#5aaa9d",
        "teal-glow":  "rgba(107,187,174,0.12)",

        // ── Colores de agente ────────────────────────────────
        "agent-ki":      "#6bbbae",
        "agent-kardex":  "#818cf8",
        "agent-info":    "#38bdf8",
      },
      fontFamily: {
        display: ["'DM Sans'", "system-ui", "sans-serif"],
        body:    ["'DM Sans'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        "glow-green": "0 0 24px rgba(74,222,128,0.18)",
        "glow-teal":  "0 0 24px rgba(107,187,174,0.18)",
        "glow-violet":"0 0 24px rgba(129,140,248,0.18)",
        "panel":      "0 4px 32px rgba(0,0,0,0.45)",
        "card":       "0 2px 12px rgba(0,0,0,0.35)",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-out",
        "slide-up":   "slideUp 0.25s ease-out",
        "slide-left": "slideLeft 0.3s ease-out",
        "pulse-dot":  "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideLeft: { "0%": { opacity: "0", transform: "translateX(20px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        pulseDot:  { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
    },
  },
  plugins: [],
};
