import Chart from "@/components/Chart";
import { PageHead, Card, Badge, Note } from "@/components/ui";
import { load } from "@/lib/data";
import { isNum } from "@/lib/format";

export const metadata = { title: "Backtest lab" };
const f = (v: any, d = 3) => (isNum(v) ? v.toFixed(d) : "—");

export default function Backtest() {
  const b = load("backtest.json");
  const reg = load("registry.json") as any[];
  const V = b.versions as Record<string, any>;
  const names = Object.keys(V);
  const prd = V["fp-1.0"];
  const icPass = prd && prd.ic_mean >= 0.05 && prd.regimes_ic_positive >= 3;
  const months = (prd.monthly as any[]).filter((m) => isNum(m.ic));
  return (
    <>
      <PageHead kicker="Validation" title="Backtest lab" meta={<Badge kind={icPass ? "pass" : "fail"} text={icPass ? "Meets PRD IC target" : "Below PRD IC target"} />}>
        Every model version scored on the same walk-forward monthly folds: rank IC of the signal against the next 3 months&apos; return relative to the cement average, hit rate, spread, long-short Sharpe deflated for the {reg.length} hypotheses tried.
      </PageHead>
      <Note tone="warn">
        PRD target: rank IC of 0.05 or higher, stable in 3 of 4 regimes. fp-1.0 scores {f(prd.ic_mean)} (Newey-West t {f(prd.ic_t, 2)}) over {prd.n_months} months. Only post-2023 months can be scored: quarterly EPS starts FY21 and the P/E norm needs 24 months of history, so the regime test cannot run yet. With 12 stocks a month, one rank swap moves IC by about 0.04. Neither version supports ranking cement stocks on the forward-path median. Drivers in fp-1.0: {b.drivers_used.join(", ")} ({b.drivers_used_basis}).
      </Note>
      <Card className="mt-5" title="Model versions, same folds">
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr><th>Version</th><th>Signal</th><th className="r">Months</th><th className="r">Rank IC</th><th className="r">IC t (NW)</th><th className="r">Hit rate</th><th className="r">Top–bottom spread, 3M</th><th className="r">Sharpe, 1M L/S</th><th className="r">Deflated Sharpe</th><th className="r">Turnover</th><th className="r">Regimes IC &gt; 0</th></tr></thead>
            <tbody>{names.map((n) => { const v = V[n]; return (
              <tr key={n}><td className="font-mono text-xs">{n}</td><td className="text-xs text-muted">{n === "fp-1.0" ? "P/E reversion + driver composite" : "P/E reversion only (control)"}</td>
                <td className="r num">{v.n_months}</td><td className={`r num ${v.ic_mean > 0 ? "text-pos" : "text-neg"}`}>{f(v.ic_mean)}</td><td className="r num">{f(v.ic_t, 2)}</td>
                <td className="r num">{f(v.hit_rate * 100, 0)}%</td><td className="r num">{f(v.spread_mean * 100, 2)}%</td><td className="r num">{f(v.sharpe_ann, 2)}</td>
                <td className="r num">{f(v.deflated_sharpe, 2)}</td><td className="r num">{isNum(v.turnover) ? `${Math.round(v.turnover * 100)}%` : "—"}</td><td className="r num">{v.regimes_ic_positive} of {Object.keys(v.regimes).length}</td></tr>); })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-2xs text-muted">Deflated Sharpe is the probability that the true Sharpe exceeds what the best of {reg.length} random trials would show (Bailey and López de Prado). Above 0.95 would count as evidence.</p>
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Monthly rank IC, fp-1.0" sub="Spearman correlation across cement stocks between the signal and the next 3 months' relative return.">
          <div className="mt-8">
            <Chart title="Monthly rank IC" height={260} n={`${months.length} months`} source="fp-1.0 walk-forward"
              option={{
                grid: { left: 40, right: 10, top: 10, bottom: 40 },
                tooltip: { trigger: "axis", valueFormatter: "fmt:num2" },
                dataZoom: [{ type: "slider", height: 14, bottom: 4, borderColor: "token:line", fillerColor: "token:accent/0.08" }],
                xAxis: { type: "category", data: months.map((m) => m.date.slice(0, 7)) },
                yAxis: { type: "value", min: -1, max: 1 },
                series: [{ type: "bar", data: months.map((m) => ({ value: +m.ic.toFixed(3), itemStyle: { color: m.ic >= 0 ? "token:pos/0.8" : "token:neg/0.8" } })) }],
              }}
              table={{ columns: ["Month", "IC", "Spread 3M", "Regime"], rows: months.map((m) => [m.date, +m.ic.toFixed(3), +(m.spread * 100).toFixed(2), m.regime]) }} />
          </div>
        </Card>
        <Card title="By regime" sub="fp-1.0 against the control.">
          <table className="tbl text-sm">
            <thead><tr><th>Regime</th>{names.map((n) => <th key={n} className="r">{n} IC</th>)}<th className="r">Months</th></tr></thead>
            <tbody>{Object.keys(prd.regimes).map((r) => (
              <tr key={r}><td>{prd.regimes[r].label}</td>{names.map((n) => <td key={n} className={`r num ${(V[n].regimes[r]?.ic ?? 0) > 0 ? "text-pos" : "text-neg"}`}>{f(V[n].regimes[r]?.ic)}</td>)}<td className="r num">{prd.regimes[r].n}</td></tr>))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card className="mt-5" title="Experiment registry" sub="Append-only. Every hypothesis tested, with the false discovery rate adjustment applied.">
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr><th>ID</th><th>Hypothesis</th><th>Source</th><th>Date</th><th className="r">Tests in family</th><th className="r">Raw p</th><th className="r">Adjusted</th><th>Method</th><th>Verdict</th></tr></thead>
            <tbody>{reg.map((r) => (
              <tr key={r.exp_id}><td className="font-mono text-xs">{r.exp_id}</td><td className="min-w-[260px]">{r.hypothesis}</td><td className="text-xs text-muted">{r.analyst}</td><td className="num text-xs">{r.created_at}</td>
                <td className="r num">{r.n_tests}</td><td className="r num">{f(r.raw_p)}</td><td className="r num">{f(r.adjusted_p)}</td><td className="text-xs text-muted">{r.method}</td>
                <td><Badge kind={["validated", "kept"].includes(r.verdict) ? "validated" : r.verdict === "unstable" ? "unstable" : "unvalidated"} text={r.verdict} /></td></tr>))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
