import Link from "next/link";
import Chart from "@/components/Chart";
import { PageHead, Card, Note, Empty, Src, Badge } from "@/components/ui";
import { load } from "@/lib/data";
import { num, inr, fmtDate, isNum, pct } from "@/lib/format";

export const metadata = { title: "Broker scorecard" };
const PRETTY = (b: string) => b.replace(/SECURITIES$/, " Securities").replace(/CAPITAL$/, " Capital").replace(/FINANCIAL$/, " Financial")
  .replace(/^MOTILALOSWAL/, "Motilal Oswal").replace(/^PRABHUDASLILLADHER/, "Prabhudas Lilladher").replace(/^DOLAT/, "Dolat").replace(/^AVENDUSSPARK/, "Avendus Spark")
  .replace(/^EQUIRUS/, "Equirus").replace(/^ICICI/, "ICICI").replace(/^HDFC/, "HDFC").replace(/^AXIS/, "Axis").replace(/^IIFL/, "IIFL").replace(/^ELARA/, "Elara").replace(/^JM/, "JM")
  .replace(/^360ONE/, "360 ONE").replace(/^CENTRUM/, "Centrum").replace(/^INCRED/, "InCred").replace(/^NUVAMA/, "Nuvama").replace(/^AMBIT/, "Ambit").replace(/^EMKAY/, "Emkay")
  .replace(/^CHOICE/, "Choice").replace(/^INVESTEC/, "Investec").replace(/^SYSTEMATIX/, "Systematix").replace(/^JEFFERIES/, "Jefferies").replace(/^NOMURA/, "Nomura")
  .replace(/^BERNSTEIN/, "Bernstein").replace(/^KOTAK-IE/, "Kotak IE");

export default function Brokers() {
  const b = load("brokers.json");
  const idx = load("index.json").stocks as any[];
  const t = b.tickers?.ULTRACEMCO;
  if (!t) return <><PageHead title="Broker scorecard" /><Empty title="No broker notes extracted">Run the extraction job.</Empty></>;
  const fys = Array.from(new Set((t.views as any[]).flatMap((v) => Object.keys(v.eps)))).filter((f) => ["FY27", "FY28", "FY29"].includes(f)).sort();
  const views = (t.views as any[]).slice().sort((a, b) => b.date.localeCompare(a.date));
  const paths = (t.paths as any[]).filter((p) => p.fy === "FY28" && isNum(p.eps));
  const cur = t.current || {};
  const disp = fys.map((fy) => {
    const v = views.map((x) => x.eps[fy]).filter(isNum) as number[];
    const m = v.reduce((a, c) => a + c, 0) / v.length; const sd = Math.sqrt(v.reduce((a, c) => a + (c - m) ** 2, 0) / Math.max(v.length - 1, 1));
    return { fy, n: v.length, lo: Math.min(...v), hi: Math.max(...v), cv: sd / m };
  });
  const brokersSorted = Array.from(new Set(paths.map((p) => p.broker)));
  return (
    <>
      <PageHead kicker="Phase 2" title="Broker scorecard" meta={<><Badge kind="pilot" text="UltraTech first" /><span>{t.n_notes} notes · {t.n_brokers} brokers · {fmtDate(t.date_range[0])} to {fmtDate(t.date_range[1])}</span></>}>
        Who forecasts cement earnings well, and what a consensus weighted by that record says against the plain Bloomberg mean.
      </PageHead>
      <Note tone="warn">
        Accuracy cannot be scored yet. {t.n_notes - 1} of the {t.n_notes} extracted notes date from April 2026 or later and forecast FY27 to FY29, which have no reported actuals; only {t.n_scorable} estimates are scorable. The Airavat store holds no UltraTech broker notes before April 2026 apart from one 2023 initiation. Until older notes are extracted from the report library and Research Mailbox, the weighted consensus below uses equal weights with stale notes halved, and it is <b>not promoted</b>: the Diebold-Mariano test needs scored history.
      </Note>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Weighted against plain consensus, EPS" sub="Plain mean of extracted notes (≤180 days), Buoyant weighting, and the Bloomberg mean. Weights cap at 25% per broker.">
          <table className="tbl text-sm">
            <thead><tr><th>Year</th><th className="r">Brokers</th><th className="r">Notes mean</th><th className="r">Buoyant-weighted</th><th className="r">Bloomberg mean</th><th className="r">Weighted vs BBG</th></tr></thead>
            <tbody>{Object.entries(cur).filter(([fy]) => fys.includes(fy)).map(([fy, c]: any) => (
              <tr key={fy}><td className="font-mono text-xs">{fy}</td><td className="r num">{c.n_brokers}</td><td className="r num">{num(c.plain_mean_notes, 1)}</td>
                <td className="r num font-medium"><Src tag={`[brk-1.0 weighted, ${t.date_range[1]}]`}>{num(c.weighted, 1)}</Src></td>
                <td className="r num"><Src tag="[BBG consensus via Airavat]">{num(c.bloomberg_mean, 1)}</Src></td>
                <td className="r num">{isNum(c.bloomberg_mean) ? pct(c.weighted / c.bloomberg_mean - 1, 1) : "—"}</td></tr>))}
            </tbody>
          </table>
          <h3 className="mt-5 text-sm font-semibold">Dispersion monitor</h3>
          <table className="tbl mt-1 text-sm">
            <thead><tr><th>Year</th><th className="r">Brokers</th><th className="r">Low</th><th className="r">High</th><th className="r">Coeff. of variation</th></tr></thead>
            <tbody>{disp.map((d) => <tr key={d.fy}><td className="font-mono text-xs">{d.fy}</td><td className="r num">{d.n}</td><td className="r num">{num(d.lo, 0)}</td><td className="r num">{num(d.hi, 0)}</td><td className="r num">{(d.cv * 100).toFixed(1)}%</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Estimate paths, FY28 EPS" sub="Each dot is one broker note. The step line is the Bloomberg mean on the dates it changed.">
          <div className="mt-8">
            <Chart title="UltraTech FY28 EPS estimate paths" height={320} n={`${paths.length} estimates`} source="[broker notes, Airavat] · [BBG consensus]"
              option={{
                grid: { left: 52, right: 14, top: 20, bottom: 30 },
                tooltip: { trigger: "item" },
                xAxis: { type: "time" },
                yAxis: { type: "value", scale: true, name: "₹ per share", nameTextStyle: { fontSize: 10, align: "left" } },
                series: [
                  { name: "Broker estimate", type: "scatter", symbolSize: 7, data: paths.map((p) => ({ value: [p.date, p.eps], name: PRETTY(p.broker) })), itemStyle: { color: "token:accent/0.75" },
                    tooltip: { formatter: "{b}: ₹{c}" } },
                  { name: "Bloomberg mean", type: "line", step: "end", symbol: "none", lineStyle: { color: "token:ink", width: 1.25 },
                    data: (load("stocks/ULTRACEMCO.json").consensus.history.FY2028 || []).map((r: any) => [r[0], r[4]]) },
                ],
              }}
              table={{ columns: ["Broker", "Date", "FY28 EPS"], rows: paths.map((p) => [PRETTY(p.broker), p.date, p.eps]) }} />
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="League table, UltraTech" sub="Latest note per broker. Accuracy, bias, timeliness and call-return columns fill once estimates for reported years are extracted.">
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr><th>Broker</th><th>Latest note</th><th>Rating</th><th className="r">Target ₹</th>{fys.map((f) => <th key={f} className="r">{f} EPS</th>)}{fys.slice(0, 2).map((f) => <th key={f} className="r">{f} vs BBG</th>)}<th className="r">Notes</th><th className="r">FY1 error</th><th className="r">Bias</th><th className="r">Shrunk score</th><th className="r">Weight</th><th className="r">Extraction conf.</th></tr></thead>
            <tbody>{views.map((v) => (
              <tr key={v.broker}>
                <td className="whitespace-nowrap font-medium">{PRETTY(v.broker)}</td>
                <td className="num whitespace-nowrap text-xs">{v.date}</td>
                <td className="text-xs">{v.rating}</td>
                <td className="r num"><Src tag={v.source}>{isNum(v.tp) ? num(v.tp) : "—"}</Src></td>
                {fys.map((f) => <td key={f} className="r num">{isNum(v.eps[f]) ? num(v.eps[f], 1) : "—"}</td>)}
                {fys.slice(0, 2).map((f) => <td key={f} className={`r num ${(v.vs_bbg[f] ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{isNum(v.vs_bbg[f]) ? pct(v.vs_bbg[f], 1) : "—"}</td>)}
                <td className="r num">{v.n_notes}</td>
                <td className="r text-muted">—</td><td className="r text-muted">—</td><td className="r text-muted">—</td>
                <td className="r num">{isNum(cur.FY28?.weights?.[v.broker]) ? `${(cur.FY28.weights[v.broker] * 100).toFixed(1)}%` : "—"}</td>
                <td className={`r num ${v.confidence < 0.8 ? "text-warn" : ""}`}>{isNum(v.confidence) ? v.confidence.toFixed(2) : "—"}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-2xs text-muted">Rows with extraction confidence below 0.80 are in the Data health review queue. Broker names and broker-level numbers are internal only; Research Studio strips them from external packs.</p>
      </Card>

      <Card className="mt-5" title="Other cement stocks" sub="Broker extraction status.">
        <div className="flex flex-wrap gap-2">
          {idx.filter((x) => x.ticker !== "ULTRACEMCO").map((x) => <Link key={x.ticker} href={`/stock/${x.ticker}`} className="rounded-chip border border-line px-2 py-1 text-xs text-muted hover:text-ink">{x.name}: not extracted</Link>)}
        </div>
      </Card>
    </>
  );
}
