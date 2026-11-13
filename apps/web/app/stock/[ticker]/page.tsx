import Link from "next/link";
import { notFound } from "next/navigation";
import Chart from "@/components/Chart";
import Waterfall from "@/components/stock/Waterfall";
import KpiHistory from "@/components/stock/KpiHistory";
import { Card, PageHead, Stat, Delta, Src, Badge, Note, Empty } from "@/components/ui";
import { stock, tickers } from "@/lib/data";
import { pct, num, inr, fmtDate, isNum, crore } from "@/lib/format";

export function generateStaticParams() { return tickers().map((ticker) => ({ ticker })); }
export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params; return { title: ticker };
}

export default async function Stock({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!tickers().includes(ticker)) notFound();
  const s = stock(ticker);
  const h = s.header;
  const f = s.forward;
  const br = s.brokers;
  const cons = s.consensus;
  const fys = Object.keys(cons.annual || {}).sort();
  const recs = h.recs || {};
  const tl = (s.timeline as any[]).slice().reverse();
  const ser = s.series as any[];
  const bbgTag = `[BBG consensus ${h.consensus_asof}]`;
  const hist = cons.history || {};
  return (
    <>
      <PageHead kicker={`${s.sector} · NSE ${s.ticker}`} title={s.name}
        meta={<><Link href={`/forward?t=${s.ticker}`} className="rounded-chip border border-line px-2 py-1 text-ink hover:border-muted">Forward paths</Link><span>Prices to {fmtDate(s.as_of)}</span></>}>
      </PageHead>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-7">
          <Stat label="Price" value={inr(h.price, 0)} src={`[AIRAVAT:get_price_history ${s.as_of}]`} sub={<>1D <Delta v={h.r1d} className="text-2xs" /></>} />
          <Stat label="1M / 12M" value={<><Delta v={h.r1m} /> <span className="text-muted">/</span> <Delta v={h.r12m} /></>} />
          <Stat label="Market cap" value={isNum(h.mcap_cr) ? `₹${num(h.mcap_cr / 1000, 1)}k cr` : "—"} sub="price × shares implied by PAT/EPS" />
          <Stat label="Trailing P/E" value={num(h.pe_now, 1)} src="[ACE LTM EPS] / price" sub={`LTM EPS ${inr(h.eps_ltm, 1)}`} />
          <Stat label="Bloomberg DCF value" value={inr(h.bbg_dcf_price)} src={`[BBG DCF ${h.bbg_dcf_asof}]`}
            sub={isNum(h.bbg_dcf_price) ? <>upside {pct(h.bbg_dcf_price / h.price - 1, 0)}</> : "not returned"} />
          <Stat label="Buy / Hold / Sell" value={recs.total ? `${recs.buy} / ${recs.hold} / ${recs.sell}` : "—"} src={bbgTag} sub={recs.as_of ? `as of ${fmtDate(recs.as_of)}` : undefined} />
          <Stat label="Broker target, mean" value={br?.tp_mean_120d ? inr(br.tp_mean_120d) : "—"}
            src={br ? `[Broker notes extracted, ${br.tp_n_120d} notes ≤120d]` : undefined}
            sub={br?.tp_mean_120d ? <>{br.tp_n_120d} notes · upside {pct(br.tp_mean_120d / h.price - 1, 0)}</> : "extraction pending for this stock"} />
        </div>
        <p className="mt-3 text-2xs text-muted">Bloomberg&apos;s consensus target price is not in the Airavat feed; the DCF value is Bloomberg&apos;s own model. The Buoyant-weighted target stays equal-weighted until brokers have scored history (see Broker scorecard).</p>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Where the return came from" sub="Log return bridged from market to sector to style to stock-specific; the specific part split into earnings growth against peers and the rest.">
          <Waterfall windows={s.waterfall} asOf={s.as_of} />
        </Card>
        <Card title="Price, relative to market, and cumulative stock-specific return" sub="Weekly. Relative = log price minus log market factor, rebased.">
          <div className="mt-8">
            <Chart title={`${s.ticker} price history`} height={300} asOf={s.as_of} n={`${ser.length} weeks`} source="[AIRAVAT:get_price_history]"
              option={{
                grid: { left: 52, right: 14, top: 30, bottom: 50 },
                legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", valueFormatter: "fmt:pct1" },
                dataZoom: [{ type: "slider", height: 16, bottom: 6, borderColor: "token:line", fillerColor: "token:accent/0.08", handleStyle: { color: "token:muted" }, textStyle: { color: "token:muted" } }],
                xAxis: { type: "category", data: ser.map((x) => x.d) },
                yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                series: [
                  { name: "Relative to market", type: "line", symbol: "none", data: ser.map((x) => (x.rel == null ? null : +((x.rel - (ser.find((y) => y.rel != null)?.rel ?? 0)) * 100).toFixed(2))), lineStyle: { color: "token:c-market", width: 1.25 }, itemStyle: { color: "token:c-market" } },
                  { name: "Cumulative stock-specific", type: "line", symbol: "none", data: ser.map((x) => (x.spec == null ? null : +(x.spec * 100).toFixed(2))), lineStyle: { color: "token:accent", width: 1.75 }, itemStyle: { color: "token:accent" } },
                ],
              }}
              table={{ columns: ["Week", "Price", "Relative (log)", "Cum. specific (log)"], rows: ser.map((x) => [x.d, x.px, x.rel, x.spec]) }} />
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Driver panel" sub="This stock's sensitivities, shrunk toward the cement panel estimate. Latest value against the average of the previous four quarters (KPI consensus is not in the feed yet).">
        {s.drivers.length === 0 ? <Empty title="Too few quarters">This stock has fewer than six quarters with both drivers and a post-results window.</Empty> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Driver</th><th className="r">Effect per 1 SD</th><th className="r">90% interval</th><th className="r">Sector effect</th><th className="r">Own-data weight</th><th className="r">Latest</th><th className="r">Prev. 4Q avg</th><th>Leads?</th><th>Status</th></tr></thead>
              <tbody>{(s.drivers as any[]).slice(0, 8).map((d) => {
                const sc = ["volume_growth", "realisation_yoy", "cost_per_t_yoy", "revenue_yoy", "petcoke_chg", "coal_chg", "brent_chg", "inr_chg", "volume_surprise", "power_fuel_per_t_yoy", "prior_specific_3m"].includes(d.code) ? 100 : 1;
                const unit = sc === 100 ? "%" : d.code === "ebitda_per_t_yoy" ? " ₹/t" : d.code === "ebitda_margin_chg" ? " pp" : "";
                return (
                  <tr key={d.code}>
                    <td><div className="text-ink">{d.label}</div>{d.departs && <span className="text-2xs text-neg">Departs from sector sign</span>}</td>
                    <td className={`r num ${d.ci90[0] > 0 ? "text-pos" : d.ci90[1] < 0 ? "text-neg" : ""}`}>{pct(d.effect_sd, 1)}</td>
                    <td className="r num text-muted">{pct(d.ci90[0], 1)} to {pct(d.ci90[1], 1)}</td>
                    <td className="r num text-muted">{pct(d.sector_effect_sd, 1)}</td>
                    <td className="r num">{Math.round(d.weight_own * 100)}% <span className="text-2xs text-muted">n={d.n}</span></td>
                    <td className="r num"><Src tag={`[driver ${d.code} ${d.latest_period}]`}>{isNum(d.latest) ? num(d.latest * sc, 1) + unit : "—"}</Src></td>
                    <td className="r num text-muted">{isNum(d.avg_prev4) ? num(d.avg_prev4 * sc, 1) + unit : "—"}</td>
                    <td className="text-xs">{d.leads}</td>
                    <td><Badge kind={d.label_status} /></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="KPI history against price" sub="Each quarter's driver value and the stock-specific return from day −1 to +60 after results.">
          <KpiHistory rows={s.timeline} asOf={s.as_of} />
        </Card>
        <Card title="Consensus" sub={`Bloomberg mean via Airavat, updated ${fmtDate(h.consensus_asof)}. Revisions are EPS change over the period.`}>
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Year</th><th className="r">Sales ₹ cr</th><th className="r">EBITDA ₹ cr</th><th className="r">EPS ₹</th><th className="r">P/E</th><th className="r">EPS 1M</th><th className="r">3M</th><th className="r">12M</th></tr></thead>
              <tbody>{fys.map((fy) => {
                const a = cons.annual[fy] || {}; const rv = (cons.revisions || {})[fy] || {};
                return (
                  <tr key={fy}>
                    <td className="font-mono text-xs">{fy}</td>
                    <td className="r num"><Src tag={`${bbgTag} ${fy}`}>{num(a.Sales / 10)}</Src></td>
                    <td className="r num">{num(a.EBITDA / 10)}</td>
                    <td className="r num">{num(a.EPS, 1)}</td>
                    <td className="r num">{num(a.PE, 1)}</td>
                    {["1m", "3m", "12m"].map((k) => <td key={k} className={`r num ${(rv[k]?.EPS ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{isNum(rv[k]?.EPS) ? `${rv[k].EPS > 0 ? "+" : ""}${rv[k].EPS.toFixed(1)}%` : "—"}</td>)}
                  </tr>);
              })}</tbody>
            </table>
          </div>
          <div className="mt-8">
            <Chart title={`${s.ticker} EPS consensus path`} height={200} source={bbgTag} n="dates the consensus changed"
              option={{
                grid: { left: 48, right: 12, top: 26, bottom: 24 },
                legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", valueFormatter: "fmt:num1" },
                xAxis: { type: "time" },
                yAxis: { type: "value", scale: true },
                series: Object.keys(hist).sort().map((fy, i) => ({
                  name: fy, type: "line", step: "end", symbol: "none", data: (hist[fy] || []).map((r: any) => [r[0], r[4]]),
                  lineStyle: { width: 1.5, color: ["token:accent", "token:c-style", "token:c-sector"][i] }, itemStyle: { color: ["token:accent", "token:c-style", "token:c-sector"][i] },
                })),
              }} />
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Results timeline" sub="Surprise = growth against the stock's own trailing trend (SUE), because day-before Bloomberg consensus by quarter is not stored yet. Returns are stock-specific (factor residual).">
        <div className="-mx-4 max-h-[460px] overflow-auto">
          <table className="tbl text-sm">
            <thead><tr><th>Quarter</th><th>Results date</th><th className="r">Revenue ₹ cr</th><th className="r">EBITDA ₹ cr</th><th className="r">PAT ₹ cr</th><th className="r">Volume Mt</th><th className="r">Rev. SUE</th><th className="r">EBITDA SUE</th><th className="r">PAT SUE</th><th className="r">Day −1..+3</th><th className="r">+4..+60</th></tr></thead>
            <tbody>{tl.map((r) => (
              <tr key={r.period}>
                <td className="font-mono text-xs">{r.period}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(r.event_date)} {r.date_source !== "results_date" && <span className="text-2xs text-warn" title="No announcement date on file: quarter end + 45/60 days">est.</span>}</td>
                <td className="r num"><Src tag={`[AIRAVAT:get_financials ${r.period}]`}>{num(r.rev_cr)}</Src></td>
                <td className="r num">{num(r.ebitda_cr)}</td>
                <td className="r num">{num(r.pat_cr)}</td>
                <td className="r num">{isNum(r.volume_mt) ? num(r.volume_mt, 1) : "—"}</td>
                {["revenue_sue", "ebitda_sue", "pat_sue"].map((k) => <td key={k} className={`r num ${r[k] > 0 ? "text-pos" : r[k] < 0 ? "text-neg" : "text-muted"}`}>{isNum(r[k]) ? r[k].toFixed(1) : "—"}</td>)}
                <td className="r"><Delta v={r.y_react} /></td>
                <td className="r"><Delta v={r.y_drift} /></td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Forward range, 12 months" sub="Monte Carlo, 10,000 paths.">
          {f ? (
            <>
              <div className="num text-[22px] text-ink">{pct(f.horizons["12m"].pct.p50, 0)} <span className="text-sm text-muted">median</span></div>
              <p className="num text-sm text-muted">80% range {pct(f.horizons["12m"].pct.p10, 0)} to {pct(f.horizons["12m"].pct.p90, 0)} · P(beat market) {Math.round(f.horizons["12m"].p_beat_market * 100)}%</p>
              <Link href={`/forward?t=${s.ticker}`} className="mt-2 inline-block text-sm text-accent hover:underline">Open forward paths</Link>
            </>
          ) : <Empty title="No forward range">Consensus EPS for two forward years is needed.</Empty>}
        </Card>
        <Card title="Commentary check" sub="Narrative Map tone against actual KPI direction.">
          <Empty title="Waiting on Narrative Map API">Airavat Labs has no API for Narrative Map scores yet (dependency logged). Once available, mismatches between management tone and the KPI print show here.</Empty>
        </Card>
        <Card title="Data flags" sub="Validation rules that fired for this stock.">
          {s.data_flags.length === 0 ? <p className="text-sm text-muted">No rule fired.</p> : (
            <ul className="max-h-[180px] space-y-1.5 overflow-auto text-xs">
              {s.data_flags.slice(0, 12).map((x: any, i: number) => (
                <li key={i}><Badge kind={x.severity === "error" ? "unstable" : "unvalidated"} text={x.rule} /> <span className="num text-muted">{x.period}: {x.detail}</span></li>
              ))}
            </ul>
          )}
          <Link href="/health" className="mt-2 inline-block text-xs text-accent hover:underline">Data health</Link>
        </Card>
      </div>
    </>
  );
}
