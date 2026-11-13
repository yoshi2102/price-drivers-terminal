import type { Config } from "tailwindcss";
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: v("paper"), surface: v("surface"), sunk: v("sunk"), ink: v("ink"), muted: v("muted"),
        line: v("line"), accent: v("accent"), "accent-ink": v("accent-ink"), pos: v("pos"), neg: v("neg"), warn: v("warn"),
        "c-market": v("c-market"), "c-sector": v("c-sector"), "c-style": v("c-style"), "c-specific": v("c-specific"),
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', "ui-sans-serif"],
        display: ['"Newsreader"', "ui-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace"],
      },
      fontSize: { "2xs": ["11px", "14px"], xs: ["12px", "16px"], sm: ["13px", "18px"], base: ["14px", "21px"] },
      borderRadius: { chip: "3px", card: "6px" },
      maxWidth: { content: "1440px" },
    },
  },
  plugins: [],
} satisfies Config;
