import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Card, Badge, Note } from "@/components/ui";
import { kpiSectors, kpiSector, LIVE_MODEL } from "@/lib/data";

export function generateStaticParams() { return kpiSectors().map((s) => ({ code: s.code })); }
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; return { title: kpiSector(code)?.name || code };
}

export default async function KpiSectorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = kpiSector(code);
  if (!s) notFound();
  const m = s.mofsl_2qfy27 || {};
  const core = (s.kpis || []).filter((k: any) => k.priority === "core");
  const rest = (s.kpis || []).filter((k: any) => k.priority !== "core");
  const Row = ({ k }: { k: any }) => (
    <tr>
      <td className="min-w-[180px]">
        <div className="font-medium text-ink">{k.name}</div>
        <div className="font-mono text-2xs text-muted">{k.formula}</div>
        <div className="mt-1 text-2xs text-muted">{k.unit} · {k.frequency}</div>
      </td>
      <td className="min-w-[260px] text-xs"><div className="text-ink">{k.definition}</div><div className="mt-1 text-muted">{k.why_it_moves_price}</div></td>
      <td className="min-w-[220px] text-xs text-muted">{k.history_source}</td>
      <td className="min-w-[220px] text-xs text-muted">{k.estimate_source}</td>
      <td className="min-w-[180px] text-xs text-warn">{k.traps}</td>
      <td className="font-mono text-2xs text-muted">{(k.examples || []).map((t: string) => <div key={t}>{t}</div>)}</td>
    </tr>
  );
  return (
    <>
      <PageHead kicker={`KPI library · ${s.group}`} title={s.name}
        meta={<>{LIVE_MODEL[s.code] && <Link href={`/sector/${LIVE_MODEL[s.code]}`} className="rounded-chip border border-line px-2 py-1 text-ink hover:border-muted">Open live model</Link>}
          <Link href="/kpis" className="rounded-chip border border-line px-2 py-1 text-ink hover:border-muted">All sectors</Link>
          {s.buoyant_skill && <span className="font-mono">{s.buoyant_skill.replace("anthropic-skills:", "")}</span>}</>}>
        {s.subsectors?.length ? <>Covers {s.subsectors.join(", ")}.</> : null}
      </PageHead>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="How profit is built">
          <p className="rounded-card border border-line bg-sunk/50 px-3 py-2 font-mono text-sm text-ink">{s.unit_economics}</p>
          <h3 className="mt-4 text-sm font-semibold">What moves the share price</h3>
          <ol className="mt-2 space-y-2">
            {(s.price_drivers || []).map((d: any, i: number) => (
              <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-sm">
                <span className={`num text-center font-medium ${d.sign === "-" ? "text-neg" : "text-pos"}`} aria-label={d.sign === "-" ? "negative for price" : "positive for price"}>{d.sign === "-" ? "−" : d.sign === "+" ? "+" : "±"}</span>
                <span><b className="text-ink">{d.driver}.</b> <span className="text-muted">{d.why}</span></span>
              </li>))}
          </ol>
          <p className="mt-4 text-xs text-muted"><b className="text-ink">Valuation anchor:</b> {s.valuation_anchor}</p>
        </Card>
        <Card title="MOFSL 2QFY27 review" sub={m.pages ? `India Strategy, Nov 2026, p. ${m.pages.join(", ")}` : undefined}>
          <p className="text-sm font-medium text-ink">{m.headline}</p>
          <p className="mt-2 text-sm text-muted">{m.read}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {m.surprises?.length ? <span><span className="text-pos">Beats:</span> <span className="font-mono">{m.surprises.join(", ")}</span></span> : null}
            {m.misses?.length ? <span><span className="text-neg">Misses:</span> <span className="font-mono">{m.misses.join(", ")}</span></span> : null}
          </div>
          {s.watch_next_quarter && <div className="mt-4"><Note tone="warn"><b>Watch in 3QFY27:</b> {s.watch_next_quarter}</Note></div>}
        </Card>
      </div>

      <Card className="mt-5" title="Core KPIs" sub="The few numbers that explain most of the share price. History source = where 5+ years of the series sit in Airavat; estimate source = where forward numbers come from.">
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr><th>KPI</th><th>What it is and why price cares</th><th>History</th><th>Estimates</th><th>Traps</th><th>Examples</th></tr></thead>
            <tbody>{core.map((k: any) => <Row key={k.code} k={k} />)}</tbody>
          </table>
        </div>
      </Card>
      {rest.length > 0 && (
        <Card className="mt-5" title="Secondary KPIs">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>KPI</th><th>What it is and why price cares</th><th>History</th><th>Estimates</th><th>Traps</th><th>Examples</th></tr></thead>
              <tbody>{rest.map((k: any) => <Row key={k.code} k={k} />)}</tbody>
            </table>
          </div>
        </Card>
      )}
      {(s.macro_inputs || []).length > 0 && (
        <Card className="mt-5" title="Macro and commodity inputs">
          <table className="tbl text-sm">
            <thead><tr><th>Series</th><th>Source</th><th>Why it matters</th></tr></thead>
            <tbody>{s.macro_inputs.map((x: any) => <tr key={x.series}><td>{x.series}</td><td className="text-xs text-muted">{x.source}</td><td className="text-xs text-muted">{x.why}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
