"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Layers, CandlestickChart, Sigma, CalendarClock, Scale, Route, FlaskConical, Activity,
  FileStack, Search, Sun, Moon, Command, X, BookOpen, ListTree,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/sector/cement", label: "Sectors", icon: Layers, match: "/sector" },
  { href: "/stock/ULTRACEMCO", label: "Stock", icon: CandlestickChart, match: "/stock" },
  { href: "/attribution", label: "Attribution explorer", icon: Sigma },
  { href: "/events", label: "Event studies", icon: CalendarClock },
  { href: "/brokers", label: "Broker scorecard", icon: Scale },
  { href: "/forward", label: "Forward paths", icon: Route },
  { href: "/backtest", label: "Backtest lab", icon: FlaskConical },
  { href: "/health", label: "Data health", icon: Activity },
  { href: "/studio", label: "Research studio", icon: FileStack },
  { href: "/kpis", label: "KPI library", icon: ListTree },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

type Item = { label: string; hint: string; href: string };

function Palette({ items, open, onClose }: { items: Item[]; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 12);
    return items.filter((x) => (x.label + " " + x.hint).toLowerCase().includes(s)).slice(0, 12);
  }, [q, items]);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  if (!open) return null;
  const go = (it?: Item) => { if (it) { router.push(it.href); onClose(); } };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search and commands" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-card border border-line bg-surface shadow-[0_18px_60px_rgba(0,0,0,.25)]">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-muted" aria-hidden />
          <label htmlFor="cmdk" className="sr-only">Search company, NSE code or screen</label>
          <input id="cmdk" ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, res.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === "Enter") go(res[i]);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Company, NSE code or screen" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          <button onClick={onClose} aria-label="Close" className="rounded-chip p-1 text-muted hover:bg-sunk"><X size={16} /></button>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-auto p-1">
          {res.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches “{q}”. Try an NSE code such as ULTRACEMCO.</li>}
          {res.map((r, k) => (
            <li key={r.href} role="option" aria-selected={k === i}>
              <button onMouseEnter={() => setI(k)} onClick={() => go(r)}
                className={`flex w-full items-center justify-between rounded-chip px-3 py-2 text-left text-sm ${k === i ? "bg-sunk" : ""}`}>
                <span className="text-ink">{r.label}</span><span className="font-mono text-2xs text-muted">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem("pdt.theme"); } catch {}
    const isDark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
  }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("pdt.theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-card border border-line text-muted hover:text-ink">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export default function Shell({ children, stocks, snapshot }: { children: ReactNode; stocks: { ticker: string; name: string }[]; snapshot: { id: string; asOf: string; code: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items: Item[] = useMemo(() => [
    ...stocks.map((s) => ({ label: s.name, hint: s.ticker, href: `/stock/${s.ticker}` })),
    ...stocks.map((s) => ({ label: `${s.name}: forward paths`, hint: "Forward", href: `/forward?t=${s.ticker}` })),
    ...NAV.map((n) => ({ label: n.label, hint: "Screen", href: n.href })),
    { label: "IT services sector", hint: "Sector", href: "/sector/it-services" },
    { label: "Cement sector", hint: "Sector", href: "/sector/cement" },
  ], [stocks]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const active = (n: (typeof NAV)[number]) => (n.href === "/" ? path === "/" : path.startsWith(n.match || n.href.split("?")[0]));
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 pb-3 pt-4">
          <Link href="/" className="block">
            <span className="font-display text-[19px] leading-none text-ink">Price Drivers</span>
            <span className="mt-1 block text-2xs text-muted">Buoyant Capital · internal</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-auto px-2" aria-label="Screens">
          <ul className="space-y-0.5">
            {NAV.map((n) => {
              const I = n.icon; const on = active(n);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={on ? "page" : undefined}
                    className={`flex h-9 items-center gap-2.5 rounded-card px-2.5 text-sm ${on ? "bg-sunk font-medium text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink"}`}>
                    <I size={16} aria-hidden className={on ? "text-accent" : ""} /> {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-4 py-3 text-2xs leading-relaxed text-muted">
          <div>Snapshot <span className="font-mono text-ink">{snapshot.id}</span></div>
          <div>Prices to <span className="font-mono">{snapshot.asOf}</span></div>
          <div>Code <span className="font-mono">{snapshot.code}</span></div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-4 lg:px-8">
            <Link href="/" className="font-display text-[17px] text-ink lg:hidden">Price Drivers</Link>
            <button onClick={() => setOpen(true)}
              className="ml-auto flex h-8 w-full max-w-[380px] items-center gap-2 rounded-card border border-line bg-surface px-2.5 text-sm text-muted hover:border-muted lg:ml-0">
              <Search size={15} aria-hidden /> <span className="truncate">Search company or NSE code</span>
              <kbd className="ml-auto hidden items-center gap-0.5 rounded-chip border border-line px-1 font-mono text-2xs sm:inline-flex"><Command size={10} />K</kbd>
            </button>
            <span className="ml-auto hidden items-center gap-1.5 rounded-chip border border-line px-2 py-1 text-2xs text-muted md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-pos" aria-hidden /> Cement + IT services · data to {snapshot.asOf}
            </span>
            <ThemeToggle />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="Screens">
            {[...NAV.slice(0, 7), NAV[NAV.length - 1]].map((n) => (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-chip px-2 py-1 text-xs ${active(n) ? "bg-ink text-paper" : "text-muted"}`}>{n.label}</Link>
            ))}
          </nav>
        </div>
        <main id="main" className="mx-auto max-w-content px-4 py-6 lg:px-8">{children}</main>
      </div>
      <Palette items={items} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
