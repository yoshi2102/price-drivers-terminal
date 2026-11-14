import Link from "next/link";
/* Sector switch rendered as links, so each sector view has its own URL. */
export default function SectorTabs({ items, active, hrefFor }: { items: { code: string; name: string }[]; active: string; hrefFor: (code: string) => string }) {
  return (
    <nav className="inline-flex rounded-card border border-line bg-surface p-0.5" aria-label="Sector">
      {items.map((s) => (
        <Link key={s.code} href={hrefFor(s.code)} aria-current={s.code === active ? "page" : undefined}
          className={`rounded-[4px] px-2.5 py-1 text-xs ${s.code === active ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{s.name}</Link>
      ))}
    </nav>
  );
}
