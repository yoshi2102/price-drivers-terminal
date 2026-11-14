import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Chart from "@/components/Chart";
import Forest from "@/components/Forest";
import { ShareBar, Legend4 } from "@/components/Spark";
import { Card, PageHead, Badge, Note, Src, Delta } from "@/components/ui";
import { load, sectors } from "@/lib/data";
import SectorTabs from "@/components/SectorTabs";
import { pct, num, isNum } from "@/lib/format";

export function generateStaticParams() { return sectors().map((s) => ({ sector: s.code })); }
export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params; return { title: sectors().find((s) => s.code === sector)?.name || sector };
}

const GATE_SHORT: Record<string, string> = { sign: "the sign check", bh: "multiple-testing correction", oos: "out of sample", regime: "regime stability", placebo: "the placebo test", sample: "sample size" };
const GATE_LABEL: Record<string, string> = { sign: "Sign matches prior", bh: "BH q < 0.10", oos: "OOS R² > 0 in 70% of 6+ folds", regime: "Same sign in 3 of 4 regimes", placebo: "Beats 95% of placebos", sample: "8+ stocks, 60+ obs" };

export default async function Sector({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  if (!sectors().some((x) => x.code === sector)) notFound();
  const s = load(`sector_${sector}.json`);
  const idx = load("index.json").stocks as any[];
  const names = Object.fromEntries(idx.map((x) => [x.ticker, x.name]));
  const lb = s.leaderboard as any[];
  const tested = lb.filter((r) => r.status !== "insufficient");
  const scale = Math.max(...tested.map((r) => Math.max(Math.abs(r.ci90[0]), Math.abs(r.ci90[1])))) * 1.05;
  const nVal = tested.filter((r) => r.validated).length;
  const dec = (s.decomposition as any[]).slice(-24);
  const top = [...tested].filter((r) => isNum(r.p)).sort((a, b) => a.p - b.p).slice(0, 4);
  const regimeCodes = (s.regimes as any[]).map((r) => r.code);
  const en = s.discovery.elastic_net, gbm = s.discovery.gbm;
  return (
    <>
      <PageHead kicker="Sector" title={s.sector}
        meta={<><SectorTabs items={sectors()} active={sector} hrefFor={(c) => `/sector/${c}`} /><Badge kind="pilot" text={sector === "cement" ? "Pilot" : "Second sector"} /><span className="num">{s.panel_n} stock-quarters · {s.panel_periods[0]}–{s.panel_periods[1]}</span></>}>
        {nVal === 0
          ? <>No driver passes all six acceptance gates yet. The strongest candidate, <b className="text-ink">{top[0]?.label.toLowerCase()}</b>, has p = {top[0]?.p?.toFixed(3)} before correction and q = {top[0]?.q?.toFixed(2)} after it, and passes {top[0] ? Object.values(top[0].gates).filter((g: any) => g.pass).length : 0} of 6 gates{top[0] ? `; it fails ${Object.entries(top[0].gates).filter(([, g]: any) => !g.pass).map(([k]) => GATE_SHORT[k]).join(", ")}` : ""}. Stock-specific news explains {pct(s.share_explained.specific, 0, false)} of daily variance, so most of what moves these stocks is not in the KPI set tested so far.</>
          : <>{nVal} of {tested.length} tested drivers pass every acceptance gate.</>}
      </PageHead>

      <Card title="Driver leaderboard" sub={<>Effect of a 1 SD move in the driver on the stock-specific return from day −1 to +60 around results. Stock and quarter fixed effects, standard errors clustered by stock and quarter. {s.date_basis.results_date} events use announced dates; {s.date_basis.fallback_lag} use quarter end + 45/60 days.</>}>
        <div className="-mx-4 overflow-x-auto">
          <table className="tbl text-sm">
            <thead><tr>
              <th>Driver</th><th className="r">Effect per 1 SD</th><th>90% interval</th><th className="r">Per unit</th>
              <th className="r">Incr. R²</th><th className="r">OOS folds &gt; 0</th><th>Leads price?</th><th>Stability</th><th>Gates</th><th>Status</th><th className="r">n</th>
            </tr></thead>
            <tbody>
              {lb.map((r) => r.status === "insufficient" ? (
                <tr key={r.code} className="text-muted"><td>{r.label}</td><td colSpan={9}>Too few observations ({r.n_obs ?? 0})</td><td className="r num">{r.n_obs}</td></tr>
              ) : (
                <tr key={r.code}>
                  <td className="min-w-[200px]">
                    <div className="font-medium text-ink">{r.label}</div>
                    <div className="text-2xs text-muted">{r.group}{r.prior ? " · pre-registered prior" : ""}</div>
                  </td>
                  <td className={`r num ${r.ci90[0] > 0 ? "text-pos" : r.ci90[1] < 0 ? "text-neg" : ""}`}>{pct(r.effect_sd, 1)}</td>
                  <td><Forest b={r.effect_sd} lo={r.ci90[0]} hi={r.ci90[1]} scale={scale} /></td>
                  <td className="r num whitespace-nowrap text-xs">{isNum(r.sensitivity_per_unit) ? `${pct(r.sensitivity_per_unit, 2)} / ${r.unit}` : "—"}</td>
                  <td className="r num">{pct(r.incremental_r2, 1, false)}</td>
                  <td className="r num">{isNum(r.oos_fold_share) ? `${Math.round(r.oos_fold_share * 100)}%` : "—"} <span className="text-2xs text-muted">of {r.n_folds}</span></td>
                  <td className="whitespace-nowrap text-xs">{r.leads}</td>
                  <td><Badge kind={r.stability} /></td>
                  <td>
                    <span className="inline-flex gap-0.5" role="list" aria-label="Acceptance gates">
                      {Object.entries(r.gates).map(([k, g]: any) => (
                        <span key={k} role="listitem" title={`${GATE_LABEL[k]}: ${g.pass ? "pass" : "fail"} (${g.value})`}
                          className={`flex h-4 w-4 items-center justify-center rounded-[2px] text-[9px] font-semibold ${g.pass ? "bg-pos/15 text-pos" : "bg-sunk text-muted"}`}>
                          {g.pass ? "✓" : "·"}
                        </span>))}
                    </span>
                  </td>
                  <td><Badge kind={r.label_status} /></td>
                  <td className="r num text-xs">{r.n_obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-2xs text-muted">Gates, left to right: {Object.values(GATE_LABEL).join(" · ")}. Hover a square for its value. Failed drivers stay listed so you can see what was tested.</p>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Return decomposition by quarter" sub={`Equal-weighted ${s.sector} basket, log-return points. Rolling betas, re-fit every 21 days on the prior 2 years.`}>
          <div className="mt-8">
            <Chart title={`${s.sector} return decomposition`} height={300} n={`${dec.length} quarters`} source="[AIRAVAT:get_price_history] factor model attr-1.0"
              option={{
                grid: { left: 44, right: 12, top: 30, bottom: 40 },
                legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: "fmt:pct1" },
                xAxis: { type: "category", data: dec.map((d) => d.fiscal_quarter), axisLabel: { rotate: 45, fontSize: 10 } },
                yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                series: [
                  ...["market", "sector", "style", "specific"].map((k) => ({
                    name: k === "specific" ? "Stock-specific" : k[0].toUpperCase() + k.slice(1), type: "bar", stack: "a",
                    data: dec.map((d) => +(d[k] * 100).toFixed(2)), itemStyle: { color: `token:c-${k}` }, barWidth: "60%",
                  })),
                  { name: "Total", type: "line", data: dec.map((d) => +(d.total * 100).toFixed(2)), symbol: "circle", symbolSize: 4,
                    lineStyle: { color: "token:ink", width: 1.25 }, itemStyle: { color: "token:ink" } },
                ],
              }}
              table={{ columns: ["Quarter", "Market", "Sector", "Style", "Specific", "Total"], rows: dec.map((d) => [d.fiscal_quarter, ...["market", "sector", "style", "specific", "total"].map((k) => +(d[k] * 100).toFixed(2))]) }} />
          </div>
        </Card>

        <Card title="Earnings or re-rating?" sub="Log price change split into trailing-EPS growth and P/E change. Blank where EPS was negative at either end.">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Stock</th>{["1y", "3y", "5y"].map((h) => <th key={h} className="r" colSpan={2}>{h}: EPS | P/E</th>)}</tr></thead>
              <tbody>{Object.entries(s.earnings_vs_rerating).map(([t, w]: any) => (
                <tr key={t}>
                  <td><Link href={`/stock/${t}`} className="hover:text-accent">{names[t]}</Link></td>
                  {["1y", "3y", "5y"].map((h) => w[h] ? (
                    <Fragment key={h}>
                      <td className={`r num ${w[h].earnings >= 0 ? "text-pos" : "text-neg"}`}>{pct(w[h].earnings, 0)}</td>
                      <td className={`r num ${w[h].rerating >= 0 ? "text-pos" : "text-neg"}`}>{pct(w[h].rerating, 0)}</td>
                    </Fragment>
                  ) : (<Fragment key={h}><td className="r text-muted">—</td><td className="r text-muted">—</td></Fragment>))}
                </tr>))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-2xs text-muted">EPS as reported (Financials API or ACE Equity, consolidated where filed); one-off gains inflate some years. Pre-FY21 quarters come from company decks, broker notes and call remarks; where EPS was not stated, the split is blank.</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Peer table" sub="Each stock's three strongest drivers, shrunk toward the sector estimate in proportion to how noisy the stock's own estimate is. Flag = sign opposite to the sector with |t| > 1.">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Stock</th><th>Driver 1</th><th>Driver 2</th><th>Driver 3</th><th>Departs?</th></tr></thead>
              <tbody>{(s.peer_table as any[]).map((p) => (
                <tr key={p.ticker}>
                  <td className="whitespace-nowrap"><Link href={`/stock/${p.ticker}`} className="hover:text-accent">{p.name}</Link></td>
                  {[0, 1, 2].map((i) => {
                    const d = p.top[i];
                    return <td key={i} className="text-xs">{d ? <><div className="text-ink">{d.label}</div><div className={`num ${d.shrunk >= 0 ? "text-pos" : "text-neg"}`}>{pct(d.shrunk, 1)} / SD{d.departs ? " · departs" : ""}</div></> : <span className="text-muted">—</span>}</td>;
                  })}
                  <td>{p.departs_any ? <Badge kind="unstable" text="Yes" /> : <span className="text-xs text-muted">No</span>}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Regime view" sub="Within-stock slope per regime for the four lowest-p drivers. Pre-COVID rests on the thinner FY16–FY20 quarterly history.">
          <div className="mt-8">
            <Chart title="Driver coefficients by regime" height={280} source="panel attr-1.0"
              option={{
                grid: { left: 44, right: 12, top: 30, bottom: 56 },
                legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: "fmt:pct1" },
                xAxis: { type: "category", data: top.map((r) => r.label), axisLabel: { interval: 0, width: 90, overflow: "break", fontSize: 10 } },
                yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                series: (s.regimes as any[]).map((rg, i) => ({
                  name: rg.label, type: "bar",
                  data: top.map((r) => (r.regimes[rg.code] ? +(r.regimes[rg.code].beta * 100).toFixed(2) : null)),
                  itemStyle: { color: ["token:c-market", "token:c-style", "token:c-sector", "token:c-specific"][i] },
                })),
              }}
              table={{ columns: ["Driver", ...regimeCodes], rows: top.map((r) => [r.label, ...regimeCodes.map((c) => (r.regimes[c] ? +(r.regimes[c].beta * 100).toFixed(2) : null))]) }} />
          </div>
          <div className="mt-6">
            <Chart title="Rolling 12-quarter coefficient" height={200}
              option={{
                grid: { left: 44, right: 12, top: 26, bottom: 24 },
                legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", valueFormatter: "fmt:pct1" },
                xAxis: { type: "category", data: (top[0]?.rolling || []).map((x: any) => x.period) },
                yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                series: top.slice(0, 3).map((r, i) => ({
                  name: r.label, type: "line", symbol: "none", data: r.rolling.map((x: any) => +(x.beta * 100).toFixed(2)),
                  lineStyle: { width: 1.5, color: ["token:accent", "token:c-style", "token:c-sector"][i] }, itemStyle: { color: ["token:accent", "token:c-style", "token:c-sector"][i] },
                })),
              }} />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Valuation bands" sub="Trailing P/E now against its 5-year distribution (monthly; median and IQR-based z, robust to near-zero EPS years). Forward P/E history needs consensus snapshots older than 12 months.">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Stock</th><th className="r">P/E now</th><th className="r">5y median</th><th className="r">5y P10–P90</th><th className="r">z vs 5y</th><th className="r">10y median</th></tr></thead>
              <tbody>{Object.entries(s.valuation_bands).map(([t, v]: any) => {
                const z = (v.pe_now - v["5y"].mean) / v["5y"].sd;
                return (
                  <tr key={t}>
                    <td><Link href={`/stock/${t}`} className="hover:text-accent">{names[t]}</Link></td>
                    <td className="r num"><Src tag={`[AIRAVAT:get_price_history] / [ACE LTM EPS]`}>{num(v.pe_now, 1)}</Src></td>
                    <td className="r num">{num(v["5y"].mean, 1)}</td>
                    <td className="r num text-muted">{num(v["5y"].p10, 0)}–{num(v["5y"].p90, 0)}</td>
                    <td className={`r num ${z > 1 ? "text-neg" : z < -1 ? "text-pos" : ""}`}>{isNum(z) ? z.toFixed(1) : "—"}</td>
                    <td className="r num text-muted">{num(v["10y"].mean, 1)} <span className="text-2xs">({v["10y"].n_months}m)</span></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
        </Card>
        <Card title="Driver discovery" sub={`Elastic net and LightGBM over ${s.discovery.features.length} candidates (drivers plus 1 and 2 quarter lags), purged walk-forward folds with a one-quarter embargo.`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Elastic net, in-sample R²", en.in_sample_r2], ["Elastic net, out-of-sample R²", en.oos_r2], ["LightGBM, in-sample R²", gbm.in_sample_r2], ["LightGBM, out-of-sample R²", gbm.oos_r2]].map(([l, v]: any) => (
              <div key={l}><div className="text-2xs text-muted">{l}</div><div className={`num text-[18px] ${v < 0 ? "text-neg" : "text-ink"}`}>{isNum(v) ? v.toFixed(3) : "—"}</div></div>
            ))}
          </div>
          <Note tone={gbm.kept ? "muted" : "warn"}>{gbm.kept ? "The tree model beats the linear model out of sample and is kept." : "The tree model fits the training data and fails out of sample, so it is not used. Its SHAP ranking below shows what it latched onto, not validated effects."}</Note>
          <div className="mt-8">
            <Chart title="SHAP importance (LightGBM)" height={260} n={`${s.discovery.n_obs} obs`}
              option={{
                grid: { left: 170, right: 16, top: 8, bottom: 24 },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: "fmt:num3" },
                xAxis: { type: "value" },
                yAxis: { type: "category", inverse: true, data: gbm.shap.slice(0, 10).map((r: any) => r.feature), axisLabel: { fontFamily: '"JetBrains Mono"', fontSize: 10 } },
                series: [{ type: "bar", data: gbm.shap.slice(0, 10).map((r: any) => +(r.mean_abs_shap * 100).toFixed(3)), itemStyle: { color: "token:c-market" }, barWidth: "55%" }],
              }}
              table={{ columns: ["Feature", "Mean |SHAP| (pp)", "Direction"], rows: gbm.shap.map((r: any) => [r.feature, +(r.mean_abs_shap * 100).toFixed(3), r.corr_sign > 0 ? "+" : "−"]) }} />
          </div>
        </Card>
      </div>
      <div className="mt-3"><Legend4 /></div>
    </>
  );
}
