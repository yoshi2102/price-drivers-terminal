import { ReactNode } from "react";
import { isNum, pct } from "@/lib/format";
import { CircleCheck, CircleAlert, CircleDashed, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function PageHead({ title, kicker, children, meta }: { title: string; kicker?: string; children?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        {kicker && <p className="text-xs text-muted">{kicker}</p>}
        <h1 className="font-display text-[30px] leading-[1.1] tracking-[-0.01em] text-ink">{title}</h1>
        {children && <div className="mt-2 max-w-[72ch] text-sm text-muted">{children}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{meta}</div>}
    </header>
  );
}

export function Card({ title, sub, children, className = "", action, id }: { title?: string; sub?: ReactNode; children: ReactNode; className?: string; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className={`rounded-card border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-tight text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

/* Hover/focus shows the source tag for any number. */
export function Src({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <span className="group relative inline-block cursor-help" tabIndex={0} aria-label={`Source ${tag}`}>
      <span className="decoration-line decoration-dotted underline-offset-[3px] group-hover:underline">{children}</span>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-chip border border-line bg-surface px-2 py-1 font-mono text-2xs text-muted shadow-[0_6px_24px_rgba(0,0,0,.12)] group-hover:block group-focus:block">
        {tag}
      </span>
    </span>
  );
}

export function Delta({ v, dp = 1, className = "" }: { v: unknown; dp?: number; className?: string }) {
  if (!isNum(v)) return <span className={`num text-muted ${className}`}>—</span>;
  const up = v > 0;
  return (
    <span className={`num inline-flex items-center gap-0.5 ${up ? "text-pos" : v < 0 ? "text-neg" : "text-muted"} ${className}`}>
      {v !== 0 && (up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />)}
      {pct(v, dp)}
    </span>
  );
}

export function Stat({ label, value, sub, src }: { label: string; value: ReactNode; sub?: ReactNode; src?: string }) {
  const body = <span className="num text-[20px] leading-tight text-ink">{value}</span>;
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5">{src ? <Src tag={src}>{body}</Src> : body}</div>
      {sub && <div className="mt-0.5 text-2xs text-muted">{sub}</div>}
    </div>
  );
}

const STATUS: Record<string, { cls: string; icon: any; text: string }> = {
  validated: { cls: "text-pos border-pos/40 bg-pos/5", icon: CircleCheck, text: "Validated" },
  unvalidated: { cls: "text-warn border-warn/40 bg-warn/5", icon: CircleDashed, text: "Unvalidated" },
  unstable: { cls: "text-neg border-neg/40 bg-neg/5", icon: CircleAlert, text: "Unstable" },
  stable: { cls: "text-pos border-pos/40 bg-pos/5", icon: CircleCheck, text: "Stable" },
  "regime-dependent": { cls: "text-warn border-warn/40 bg-warn/5", icon: CircleDashed, text: "Regime-dependent" },
  insufficient: { cls: "text-muted border-line bg-sunk", icon: CircleDashed, text: "Too little data" },
  pass: { cls: "text-pos border-pos/40 bg-pos/5", icon: CircleCheck, text: "Pass" },
  fail: { cls: "text-neg border-neg/40 bg-neg/5", icon: CircleAlert, text: "Fail" },
  pilot: { cls: "text-accent border-accent/40 bg-accent/5", icon: CircleCheck, text: "Pilot" },
  queued: { cls: "text-muted border-line bg-sunk", icon: CircleDashed, text: "Queued" },
};
export function Badge({ kind, text }: { kind: string; text?: string }) {
  const s = STATUS[kind] || STATUS.insufficient;
  const I = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-chip border px-1.5 py-[1px] text-2xs font-medium ${s.cls}`}>
      <I size={11} aria-hidden /> {text || s.text}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-sunk/40 px-4 py-5">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-1 max-w-[70ch] text-xs text-muted">{children}</div>
    </div>
  );
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" }) {
  return (
    <p className={`rounded-card border-l-2 px-3 py-2 text-xs ${tone === "warn" ? "border-warn bg-warn/5 text-ink" : "border-line bg-sunk/50 text-muted"}`}>
      {children}
    </p>
  );
}

export function Seg({ items, value, hrefFor }: { items: { v: string; l: string }[]; value: string; hrefFor: (v: string) => string }) {
  return (
    <nav className="inline-flex rounded-card border border-line bg-surface p-0.5" aria-label="Options">
      {items.map((i) => (
        <a key={i.v} href={hrefFor(i.v)} aria-current={i.v === value ? "page" : undefined}
          className={`rounded-[4px] px-2.5 py-1 text-xs ${i.v === value ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{i.l}</a>
      ))}
    </nav>
  );
}
