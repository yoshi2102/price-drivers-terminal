import Link from "next/link";
import Chart from "@/components/Chart";
import Spark, { ShareBar, Legend4 } from "@/components/Spark";
import { Card, PageHead, Delta, Badge, Empty, Note, Src } from "@/components/ui";
import { load } from "@/lib/data";
import { pct, num, fmtDate, isNum } from "@/lib/format";

export default function Home() {
  const h = load("home.json");
  const idx = load("index.json").stocks as any[];
  const names = Object.fromEntries(idx.map((s) => [s.ticker, s.name]));
  const live = (h.sectors as any[]).filter((x) => x.status !== "queued");
  const queued = (h.sectors as any[]).filter((x) => x.status === "queued");
  const breadth = h.breadth.stocks.filter((s: any) => isNum(s.rev1m));
  const up1 = breadth.filter((s: any) => s.rev1m > 0).length, dn1 = breadth.filter((s: any) => s.rev1m < 0).length;
  const up3 = breadth.filter((s: any) => s.rev3m > 0).length, dn3 = breadth.filter((s: any) => s.rev3m < 0).length;
  const sorted = [...breadth].sort((a, b) => a.rev3m - b.rev3m);
  const gap = [...h.revision_price_gap].filter((g: any) => isNum(g.gap)).sort((a: any, b: any) => Math.abs(b.gap) - Math.abs(a.gap));
  const commName: Record<string, string> = { brent: "Brent", petcoke: "Pet coke", coal_indonesia: "Coal, Indonesia 6322", coal_richardsbay: "Coal, Richards Bay", inrusd: "INR per USD" };
  return (
    <>
      <PageHead kicker={`Prices to ${fmtDate(h.as_of)}`} title="Pulse"
        meta={<><Badge kind="pilot" text={`Live: ${live.map((x) => x.sector).join(", ")}`} /><span>Market factor: {h.market_proxy.constituents.length} large caps, equal weight</span></>}>
        Which sectors and holdings have drivers turning, and where the street and the price disagree. {live.length} sectors are live; the rest open after the pilot gate.
      </PageHead>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Sector grid" sub="Return against the market factor, and what share of daily variance each layer explains (last 3 years).">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Sector</th><th className="r">1M</th><th className="r">3M</th><th className="r">12M</th><th className="r">vs market 12M</th><th>Variance explained</th><th>Drivers turning</th></tr></thead>
              <tbody>
                {live.map((pilot: any) => (
                <tr key={pilot.code}>
                  <td><Link className="font-medium text-accent hover:underline" href={`/sector/${pilot.code}`}>{pilot.sector}</Link> <span className="text-2xs text-muted">{pilot.n} stocks</span></td>
                  <td className="r"><Delta v={pilot.r1m} /></td><td className="r"><Delta v={pilot.r3m} /></td><td className="r"><Delta v={pilot.r12m} /></td>
                  <td className="r"><Delta v={pilot.r12m - pilot.m12m} /></td>
                  <td className="w-[180px]"><ShareBar share={pilot.share} /><span className="num mt-1 block text-2xs text-muted">specific {pct(pilot.share.specific, 0, false)}</span></td>
                  <td>{pilot.turning.length ? <span title={(pilot.turning_labels || []).join(", ")}><Badge kind="unstable" text={`${pilot.turning.length} turning`} /></span> : <span className="text-xs text-muted">None this quarter</span>}</td>
                </tr>))}
                <tr className="text-muted">
                  <td colSpan={7} className="text-xs">
                    <Badge kind="queued" text="Queued" /> <span className="ml-1">Open after the pilot go/no-go: {queued.map((x: any) => x.sector).join(", ")}.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3"><Legend4 /></div>
        </Card>

        <Card title="Alerts" sub="Price outside the model band (±2 SD of 20-day stock-specific return) or FY1 EPS consensus moved 5% or more in a month.">
          {h.alerts.length === 0 ? <Empty title="No alerts">Nothing broke a threshold in the last 20 trading days.</Empty> : (
            <ul className="divide-y divide-line">
              {h.alerts.map((a: any, i: number) => (
                <li key={i} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/stock/${a.ticker}`} className="text-sm font-medium text-ink hover:text-accent">{names[a.ticker]}</Link>
                    <span className={`text-2xs ${a.z < 0 ? "text-neg" : "text-pos"}`}>{a.kind}</span>
                  </div>
                  <p className="num text-xs text-muted">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Revision breadth" sub={`FY1 EPS consensus, ${breadth.length} stocks in ${live.length} sectors. 1 month: ${up1} up, ${dn1} down. 3 months: ${up3} up, ${dn3} down.`}>
          <div className="mt-8">
            <Chart title="FY1 EPS revisions" height={Math.max(300, sorted.length * 20)} asOf={h.as_of} n={`${breadth.length} stocks`} source="[BBG consensus via AIRAVAT:get_consensus_estimates]"
              option={{
                grid: { left: 92, right: 20, top: 26, bottom: 24 },
                legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: "fmt:pct1" },
                xAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                yAxis: { type: "category", data: sorted.map((s: any) => s.ticker), axisLabel: { fontFamily: '"JetBrains Mono"', fontSize: 10 } },
                series: [
                  { name: "1 month", type: "bar", data: sorted.map((s: any) => s.rev1m), itemStyle: { color: "token:c-market" }, barGap: "10%" },
                  { name: "3 months", type: "bar", data: sorted.map((s: any) => s.rev3m), itemStyle: { color: "token:accent" } },
                ],
              }}
              table={{ columns: ["Ticker", "FY", "1M %", "3M %"], rows: sorted.map((s: any) => [s.ticker, s.fy1, s.rev1m, s.rev3m]) }} />
          </div>
        </Card>

        <Card title="Consensus moved, price did not (3 months)" sub="Price return (pp) minus FY1 EPS revision (%). Large gaps mean the price has run ahead of, or lagged, estimate changes.">
          <div className="-mx-4 overflow-x-auto">
            <table className="tbl text-sm">
              <thead><tr><th>Stock</th><th className="r">EPS revision 3M</th><th className="r">Price 3M</th><th className="r">Gap (pp)</th></tr></thead>
              <tbody>{gap.map((g: any) => (
                <tr key={g.ticker}>
                  <td><Link href={`/stock/${g.ticker}`} className="hover:text-accent">{names[g.ticker]}</Link></td>
                  <td className="r num"><Src tag={`[BBG consensus FY1 EPS, ${fmtDate(h.as_of)}]`}>{num(g.rev3m, 1)}%</Src></td>
                  <td className="r"><Delta v={g.r3m} /></td>
                  <td className={`r num ${g.gap > 0 ? "text-pos" : "text-neg"}`}>{g.gap > 0 ? "+" : "−"}{Math.abs(g.gap).toFixed(1)}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Commodities and currency" sub="Daily Kotak series via Airavat. Last release date shown per series.">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {h.commodities.map((c: any) => (
              <div key={c.key} className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <div className="min-w-0">
                  <div className="truncate text-xs text-muted" title={c.name}>{commName[c.key] || c.name}</div>
                  <div className="num text-[15px] text-ink"><Src tag={`[AIRAVAT:get_commodity_prices ${c.date}]`}>{num(c.last, c.key === "inrusd" ? 2 : 1)}</Src></div>
                  <div className="text-2xs text-muted">{fmtDate(c.date)} · <Delta v={c.chg_1m} className="text-2xs" /> 1M</div>
                </div>
                <Spark data={c.spark} />
              </div>
            ))}
          </div>
          <div className="mt-4"><Note>Fund flows (FII, DII, MF) and macro prints (CPI, IIP, GST, PMI, credit growth, 10Y G-sec) come from Tijori, which has no service credentials yet. They appear here once the Tijori key is added to the worker.</Note></div>
        </Card>
        <Card title="Holdings overlay" sub="Portfolio weights against model expected-return ranges.">
          <Empty title="No holdings file loaded">
            Upload a daily CSV with columns <span className="font-mono">date, nse_code, weight</span> to the worker&apos;s <span className="font-mono">holdings/</span> folder. The overlay then plots each holding&apos;s weight against its 12-month model range. Upload format is an open question for IT.
          </Empty>
        </Card>
      </div>
    </>
  );
}
