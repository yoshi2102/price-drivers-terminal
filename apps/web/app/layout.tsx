import type { Metadata, Viewport } from "next";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import Shell from "@/components/Shell";
import { load, manifest } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "Price Drivers Terminal", template: "%s · Price Drivers" },
  description: "What moves each covered stock and sector, with the evidence. Buoyant Capital internal.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeBoot = `try{var t=localStorage.getItem("pdt.theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const m = manifest();
  const idx = load("index.json").stocks as { ticker: string; name: string }[];
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body>
        <Shell stocks={idx.map((s) => ({ ticker: s.ticker, name: s.name }))}
          snapshot={{ id: m.snapshot_id, asOf: m.as_of, code: m.code_hash }}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
