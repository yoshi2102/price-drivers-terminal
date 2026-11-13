import Link from "next/link";
import { PageHead, Card, Badge } from "@/components/ui";
import { load, manifest } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Data health" };

function Cell({ ok, children, title }: { ok: "good" | "part" | "none"; children: React.ReactNode; title?: string }) {
  const cls = ok === "good" ? "bg-pos/10 text-pos" : ok === "part" ? "bg-warn/10 text-warn" : "bg-sunk text-muted";
  return <td className="p-1" title={title}><div className={`num rounded-chip px-2 py-1 text-center text-2xs ${cls}`}>{children}</div></td>;
}

export default function Health() {
  const h = load("health.json");
  const m = manifest();
  const fails = h.failures as any[];
  const byRule: Record<string, number> = {};
  fails.forEach((f) => (byRule[f.rule] = (byRule[f.rule] || 0) + 1));
  const total = (h.log as any[]).reduce((a, l) => a + l.seconds, 0);
  return (
    <>
      <PageHead kicker="Operations" title="Data health" meta={<span className="font-mono">snapshot {m.snapshot_id} · code {m.code_hash} · data {m.data_hash}</span>}>
        What is loaded, what is missing, and which rules fired. Breaks are flagged, never dropped.
      </PageHead>
      <Card title="Coverage matrix" sub="Stock × dataset. Green: complete for the period; amber: partial; grey: none.">
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr><th>Stock</th><th>Prices</th><th>Quarterly financials</th><th>Sales volume (KPI)</th><th>Results dates</th><th>Consensus</th><th>Broker notes</th></tr></thead>
            <tbody>{(h.coverage as any[]).map((c) => { const d = c.datasets; return (
              <tr key={c.ticker}>
                <td className="whitespace-nowrap"><Link href={`/stock/${c.ticker}`} className="hover:text-accent">{c.name}</Link></td>
                <Cell ok={d.prices.n > 1000 ? "good" : "part"} title={`${d.prices.from} to ${d.prices.last}`}>{d.prices.from?.slice(0, 4)}–{d.prices.last}</Cell>
                <Cell ok={d.financials.n >= 26 ? "good" : "part"}>{d.financials.from}–{d.financials.last} ({d.financials.n}q)</Cell>
                <Cell ok={d.kpi_volume.n >= d.kpi_volume.of * 0.9 ? "good" : d.kpi_volume.n ? "part" : "none"}>{d.kpi_volume.n}/{d.kpi_volume.of}</Cell>
                <Cell ok={d.results_dates.n >= d.results_dates.of * 0.9 ? "good" : d.results_dates.n ? "part" : "none"}>{d.results_dates.n}/{d.results_dates.of}</Cell>
                <Cell ok={d.consensus.last ? "part" : "none"} title="Snapshot plus revision history; 12 months only">{d.consensus.last ? `${fmtDate(d.consensus.last)} · ${d.consensus.n} revs` : "—"}</Cell>
                <Cell ok={d.broker_notes.n ? "part" : "none"}>{d.broker_notes.n || "—"}</Cell>
              </tr>); })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-2xs text-muted">Volumes for 7 stocks come mostly from Motilal Oswal results tables (broker-compiled, first-published value kept); UltraTech and Dalmia partly from company decks. Financials are ACE Equity except UltraTech (Financials API, from FY23). Consensus history is limited to 12 months by the Airavat feed.</p>
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title="Validation failures" sub={Object.entries(byRule).map(([k, v]) => `${k}: ${v}`).join(" · ")}>
          <div className="-mx-4 max-h-[440px] overflow-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Rule</th><th>Stock</th><th>Period</th><th>Detail</th><th>Severity</th></tr></thead>
              <tbody>{fails.map((f, i) => (
                <tr key={i}><td className="whitespace-nowrap text-xs">{f.rule}</td><td className="font-mono text-xs">{f.ticker}</td><td className="font-mono text-xs">{f.period}</td><td className="num text-xs text-muted">{f.detail}</td>
                  <td><Badge kind={f.severity === "error" ? "unstable" : f.severity === "review" ? "unvalidated" : "regime-dependent"} text={f.severity} /></td></tr>))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Pipeline run log" sub={`Last run ${fmtDate(m.created_at?.slice(0, 10))}, ${total.toFixed(1)} s end to end.`}>
          <table className="tbl text-sm">
            <thead><tr><th>Stage</th><th>Status</th><th className="r">Seconds</th></tr></thead>
            <tbody>{(h.log as any[]).map((l, i) => <tr key={i}><td>{l.stage}</td><td><Badge kind={l.status === "ok" ? "pass" : "fail"} text={l.status} /></td><td className="r num">{l.seconds.toFixed(2)}</td></tr>)}</tbody>
          </table>
          <h3 className="mt-5 text-sm font-semibold">Run parameters</h3>
          <pre className="mt-1 max-h-[200px] overflow-auto rounded-chip bg-sunk p-2 font-mono text-2xs text-muted">{JSON.stringify(m.params, null, 1)}</pre>
          <h3 className="mt-4 text-sm font-semibold">Raw files in this snapshot</h3>
          <p className="text-xs text-muted">{h.raw_files.length} files: prices, financials, consensus, commodities, KPI volumes, results dates, broker estimates.</p>
        </Card>
      </div>
    </>
  );
}
