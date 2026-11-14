"use client";
import { useEffect, useState } from "react";
import Chart from "@/components/Chart";

const LABEL: Record<string, string> = { cc_growth_surprise: "CC growth vs own trend", guidance_mid_chg: "Guidance midpoint change", street_ebitda_surprise: "EBITDA vs street", street_revenue_surprise: "Revenue vs street", street_pat_surprise: "PAT vs street", ebitda_sue: "EBITDA surprise (own trend)", revenue_sue: "Revenue surprise", pat_sue: "PAT surprise", volume_surprise: "Volume growth surprise", ebitda_margin_chg: "EBITDA margin change" };
const COL = ["token:neg", "token:c-style", "token:c-market", "token:c-sector", "token:accent"];
const f2 = (v: any, s = 100) => (v == null ? "—" : `${v * s > 0 ? "+" : ""}${(v * s).toFixed(2)}%`);

export default function EventView({ studies, names, sector }: { studies: Record<string, any>; names: Record<string, string>; sector: string }) {
  const keys = Object.keys(studies);
  const [m, setM] = useState(keys[0]);
  useEffect(() => { const q = new URLSearchParams(location.search).get("m"); if (q && studies[q]) setM(q); }, []); // eslint-disable-line
  useEffect(() => { history.replaceState(null, "", `${location.pathname}?s=${sector}&m=${m}`); }, [m, sector]);
  const s = studies[m];
  if (!s || s.status !== "ok") return <p className="text-sm text-muted">Not enough events for {LABEL[m]} ({s?.n ?? 0}).</p>;
  const days = s.days as number[];
  const b = s.buckets as any[];
  const top = b[4], bot = b[0];
  const series: any[] = b.map((q, i) => ({
    name: `Q${q.quintile}${i === 0 ? " (most negative)" : i === 4 ? " (most positive)" : ""}`, type: "line", symbol: "none",
    data: q.curve.map((v: number) => +(v * 100).toFixed(2)), lineStyle: { width: i === 0 || i === 4 ? 2 : 1, color: COL[i] }, itemStyle: { color: COL[i] }, z: 3,
  }));
  for (const [q, c] of [[top, "token:accent/0.6"], [bot, "token:neg/0.6"]] as const) {
    for (const k of ["lo", "hi"] as const) series.push({ name: `Q${q.quintile} 90% ${k === "lo" ? "lower" : "upper"}`, type: "line", symbol: "none", silent: true,
      data: q[k].map((v: number) => +(v * 100).toFixed(2)), lineStyle: { color: c, width: 1, type: "dashed" }, itemStyle: { color: c } });
  }
  series[0].markLine = { silent: true, symbol: "none", lineStyle: { color: "token:muted", type: "dashed" }, data: [{ xAxis: "0" }, { xAxis: "3" }], label: { show: false } };
  const d = s.drift, r = s.reaction;
  const regs = s.regimes || {};
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="metric" className="text-sm text-muted">Surprise metric</label>
        <select id="metric" value={m} onChange={(e) => setM(e.target.value)} className="h-9 rounded-card border border-line bg-surface px-2 text-sm">
          {keys.map((k) => <option key={k} value={k}>{LABEL[k] || k}</option>)}
        </select>
        <span className="text-xs text-muted">{s.n} events · {s.date_basis === "results_date" ? "announced results dates only" : "includes estimated dates"}</span>
      </div>
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Cumulative abnormal return by surprise quintile</h2>
        <p className="text-xs text-muted">Abnormal return = factor-model residual. Dashed: 90% cluster-bootstrap bounds (by results week) for the top and bottom quintiles. Dashed lines mark day 0 and day +3.</p>
        <div className="mt-8">
          <Chart title={`CAR by ${LABEL[m]} quintile`} height={340} n={`${s.n} events`} source="factor model attr-1.0 · [results dates: filings, transcripts]"
            option={{
              grid: { left: 48, right: 16, top: 34, bottom: 44 },
              legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 2, textStyle: { color: "token:muted" }, data: series.slice(0, 5).map((x) => x.name) },
              tooltip: { trigger: "axis", valueFormatter: "fmt:pct1" },
              xAxis: { type: "category", data: days.map(String), name: "Trading days from results", nameLocation: "middle", nameGap: 26, nameTextStyle: { fontSize: 10 }, axisLabel: { interval: 9 } },
              yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
              series,
            }}
            table={{ columns: ["Day", ...b.map((q) => `Q${q.quintile} %`)], rows: days.map((dd, i) => [dd, ...b.map((q) => +(q.curve[i] * 100).toFixed(2))]) }} />
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Reaction and drift tests</h2>
          <table className="tbl mt-3 text-sm">
            <thead><tr><th>Window</th><th>Quintile</th><th className="r">n</th><th className="r">Mean CAR</th><th className="r">Patell z</th><th className="r">BMP t</th><th className="r">p (BMP)</th></tr></thead>
            <tbody>
              {([["Day −1..+3", r.top, "Top"], ["Day −1..+3", r.bottom, "Bottom"], ["Day +4..+60", d.top, "Top"], ["Day +4..+60", d.bottom, "Bottom"]] as any[]).map(([w, x, q], i) => (
                <tr key={i}><td>{w}</td><td>{q}</td><td className="r num">{x.n}</td><td className="r num">{f2(x.mean)}</td><td className="r num">{x.patell_z?.toFixed(2)}</td><td className="r num">{x.bmp_t?.toFixed(2)}</td><td className="r num">{x.p_bmp?.toFixed(3)}</td></tr>))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">
            Post-results drift, top minus bottom quintile: <b className="num">{f2(d.spread)}</b>, 90% bootstrap interval <span className="num">{f2(d.spread_ci90[0])} to {f2(d.spread_ci90[1])}</span>.{" "}
            {d.spread_ci90[0] > 0 || d.spread_ci90[1] < 0 ? "The interval excludes zero." : "The interval includes zero, so there is no reliable drift after day +3."}
          </p>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Has it changed since 2023?</h2>
          <table className="tbl mt-3 text-sm">
            <thead><tr><th>Period</th><th className="r">Events</th><th className="r">Reaction spread</th><th className="r">Drift spread</th><th className="r">Slope, reaction per 1 SD</th></tr></thead>
            <tbody>{Object.entries(regs).map(([k, v]: any) => (
              <tr key={k}><td>{k === "since_2023" ? "Since Jan 2023" : "Before 2023"}</td><td className="r num">{v.n}</td><td className="r num">{f2(v.react_spread)}</td><td className="r num">{f2(v.drift_spread)}</td><td className="r num">{f2(v.slope_react)}</td></tr>))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Quintile spreads need at least two events per quintile in a period; a dash means the period is too thin to compare.</p>
        </section>
      </div>
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Events</h2>
        <div className="-mx-4 mt-2 max-h-[360px] overflow-auto">
          <table className="tbl text-sm">
            <thead><tr><th>Stock</th><th>Quarter</th><th>Results date</th><th className="r">Surprise (SD)</th><th className="r">Day −1..+3</th><th className="r">+4..+60</th></tr></thead>
            <tbody>{(s.events as any[]).slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
              <tr key={e.ticker + e.period}><td>{names[e.ticker] || e.ticker}</td><td className="font-mono text-xs">{e.period}</td><td className="num text-xs">{e.date}</td>
                <td className={`r num ${e.surprise > 0 ? "text-pos" : "text-neg"}`}>{e.surprise.toFixed(2)}</td><td className="r num">{f2(e.react)}</td><td className="r num">{f2(e.drift)}</td></tr>))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
