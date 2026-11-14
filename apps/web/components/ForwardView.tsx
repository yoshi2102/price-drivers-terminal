"use client";
import { useEffect, useMemo, useState } from "react";
import Chart from "@/components/Chart";

const pc = (v: number | null | undefined, dp = 0) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(dp)}%`);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p; const l = Math.floor(i); return s[l] + (s[Math.min(l + 1, s.length - 1)] - s[l]) * (i - l); };

export default function ForwardView({ data, names, calibs, engines, sectorOf, sectorNames }: { data: Record<string, any>; names: Record<string, string>; calibs: Record<string, any>; engines: Record<string, any>; sectorOf: Record<string, string>; sectorNames: Record<string, string> }) {
  const tickers = Object.keys(data);
  const [t, setT] = useState(tickers[0]);
  const [h, setH] = useState("12m");
  const [eps, setEps] = useState(0);
  const [noRer, setNoRer] = useState(false);
  const [scen, setScen] = useState<any>(null);
  useEffect(() => { const p = new URLSearchParams(location.search); const x = p.get("t"); if (x && data[x]) setT(x); const hh = p.get("h"); if (hh) setH(hh); }, []); // eslint-disable-line
  useEffect(() => { history.replaceState(null, "", `${location.pathname}?t=${t}&h=${h}`); }, [t, h]);
  useEffect(() => {
    setScen(null);
    fetch(`${location.pathname.replace(/forward\/?$/, "")}data/scenarios/${t}.json`).then((r) => (r.ok ? r.json() : null)).then(setScen).catch(() => setScen(null));
  }, [t]);
  const f = data[t];
  const calib = calibs[sectorOf[t]];
  const engine = engines[sectorOf[t]];
  const H = f.horizons[h];
  const months: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 };

  const redraw = useMemo(() => {
    if (!scen) return null;
    const sh = scen.horizons[h]; const m = months[h];
    const shift = scen.elasticity * Math.log(1 + eps) * Math.min(1, m / 12);
    const base = sh.rest.map((r: number) => Math.expm1(sh.growth + r));
    const adj = sh.rest.map((r: number, i: number) => Math.expm1(sh.growth + r + shift - (noRer ? sh.rer[i] : 0)));
    const exAdj = sh.rest.map((r: number, i: number) => sh.growth + r + shift - (noRer ? sh.rer[i] : 0) - sh.mkt[i]);
    return { base: [0.1, 0.5, 0.9].map((p) => q(base, p)), adj: [0.1, 0.5, 0.9].map((p) => q(adj, p)), beat: exAdj.filter((x: number) => x > 0).length / exAdj.length, shift };
  }, [scen, h, eps, noRer]); // eslint-disable-line

  const hs = ["3m", "6m", "12m"];
  const x = ["Now", "3M", "6M", "12M"];
  // Price levels (always positive) so the stacked bands anchor correctly.
  const P = (k: string) => [Math.round(f.price), ...hs.map((hh) => Math.round(f.price * (1 + f.horizons[hh].pct[k])))];
  const band = (lo: string, hi: string) => P(hi).map((v, i) => v - P(lo)[i]);
  const tor = (H.tornado as any[]).slice(0, 6);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="tk" className="text-sm text-muted">Stock</label>
        <select id="tk" value={t} onChange={(e) => { setT(e.target.value); setEps(0); }} className="h-9 rounded-card border border-line bg-surface px-2 text-sm">
          {Object.keys(sectorNames).map((sc) => (
            <optgroup key={sc} label={sectorNames[sc]}>
              {tickers.filter((k) => sectorOf[k] === sc).map((k) => <option key={k} value={k}>{names[k]}</option>)}
            </optgroup>))}
        </select>
        <div className="inline-flex rounded-card border border-line bg-surface p-0.5" role="tablist" aria-label="Horizon">
          {hs.map((k) => <button key={k} role="tab" aria-selected={h === k} onClick={() => setH(k)} className={`rounded-[4px] px-2.5 py-1 text-xs ${h === k ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{k.toUpperCase()}</button>)}
        </div>
        <span className="text-xs text-muted">Price ₹{Math.round(f.price).toLocaleString("en-IN")} on {f.price_date}</span>
      </div>

      <section className="rounded-card border border-line bg-surface p-4">
        <p className="font-display text-[22px] leading-snug text-ink">
          {names[t]}, {h}: median {pc(H.pct.p50)}, 80% range {pc(H.pct.p10)} to {pc(H.pct.p90)}. Probability of beating the market: {Math.round(H.p_beat_market * 100)}%.
        </p>
        <p className="mt-1 text-sm text-muted">Biggest swing factor: {tor[0]?.input.toLowerCase()} ({pc(tor[0]?.low)} to {pc(tor[0]?.high)} on the median). 12-month-forward EPS ₹{f.eps_fwd?.toFixed(1)} on Bloomberg mean; forward P/E {f.pe_now?.toFixed(1)} against a 5-year norm of {f.pe_fair?.toFixed(1)}.</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Fan chart</h2>
          <p className="text-xs text-muted">Share price percentiles: 10th–90th (light), 25th–75th (dark), median line. Today ₹{Math.round(f.price).toLocaleString("en-IN")}.</p>
          <div className="mt-8">
            <Chart title={`${t} forward fan chart`} height={300} n="10,000 paths" source={`fp-1.0 · bands ×${(f.widen?.[h] ?? 1).toFixed(2)} after calibration`}
              option={{
                grid: { left: 64, right: 16, top: 12, bottom: 26 },
                tooltip: { trigger: "axis", valueFormatter: "fmt:inr" },
                xAxis: { type: "category", data: x, boundaryGap: false },
                yAxis: { type: "value", scale: true, axisLabel: { formatter: "₹{value}" } },
                series: [
                  { name: "P10", type: "line", data: P("p10"), stack: "f", lineStyle: { opacity: 0 }, symbol: "none", tooltip: { show: true } },
                  { name: "Band P10–P25 (width)", type: "line", data: band("p10", "p25"), stack: "f", lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "token:accent/0.12" } },
                  { name: "Band P25–P75 (width)", type: "line", data: band("p25", "p75"), stack: "f", lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "token:accent/0.28" } },
                  { name: "Band P75–P90 (width)", type: "line", data: band("p75", "p90"), stack: "f", lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "token:accent/0.12" } },
                  { name: "Median", type: "line", data: P("p50"), lineStyle: { color: "token:accent", width: 2 }, itemStyle: { color: "token:accent" }, symbolSize: 5 },
                ],
              }}
              table={{ columns: ["Horizon", "P10 ₹", "P25 ₹", "P50 ₹", "P75 ₹", "P90 ₹"], rows: x.map((xx, i) => [xx, P("p10")[i], P("p25")[i], P("p50")[i], P("p75")[i], P("p90")[i]]) }} />
          </div>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Sensitivity tornado, {h}</h2>
          <p className="text-xs text-muted">Shift in the median when one input moves to its 10th or 90th percentile.</p>
          <div className="mt-8">
            <Chart title={`${t} tornado`} height={300}
              option={{
                grid: { left: 150, right: 16, top: 10, bottom: 24 },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: "fmt:pct1" },
                xAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                yAxis: { type: "category", inverse: true, data: tor.map((r) => r.input), axisLabel: { width: 140, overflow: "break", fontSize: 10, fontFamily: '"Schibsted Grotesk"' } },
                series: [
                  { name: "Low", type: "bar", stack: "t", data: tor.map((r) => +(r.low * 100).toFixed(1)), itemStyle: { color: "token:neg/0.75" } },
                  { name: "High", type: "bar", stack: "t", data: tor.map((r) => +(r.high * 100).toFixed(1)), itemStyle: { color: "token:pos/0.75" } },
                ],
              }}
              table={{ columns: ["Input", "Low %", "High %"], rows: tor.map((r) => [r.input, +(r.low * 100).toFixed(2), +(r.high * 100).toFixed(2)]) }} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Bull, base, bear ({h})</h2>
          <p className="text-xs text-muted">Paths split at the 25th and 75th percentile of total return. EPS growth is centred on Bloomberg consensus ({pc(f.eps_growth_cons)} FY1 to FY2).</p>
          <table className="tbl mt-3 text-sm">
            <thead><tr><th>Case</th><th className="r">Probability</th><th className="r">EPS growth</th><th className="r">Implied fwd P/E</th><th className="r">Implied price</th><th className="r">Return</th></tr></thead>
            <tbody>{(H.cases as any[]).map((c) => (
              <tr key={c.case}><td className="font-medium">{c.case}</td><td className="r num">{Math.round(c.probability * 100)}%</td><td className="r num">{pc(c.eps_growth)}</td>
                <td className="r num">{c.implied_pe.toFixed(1)}</td><td className="r num">₹{Math.round(c.implied_price).toLocaleString("en-IN")}</td><td className={`r num ${c.return >= 0 ? "text-pos" : "text-neg"}`}>{pc(c.return)}</td></tr>))}
            </tbody>
          </table>
          <h3 className="mt-5 text-sm font-semibold">Where the uncertainty comes from</h3>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(H.contrib).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => (
              <li key={k} className="grid grid-cols-[170px_1fr_44px] items-center gap-2 text-xs">
                <span className="text-muted">{k}</span>
                <span className="h-2 rounded-chip bg-sunk"><span className="block h-2 rounded-chip bg-c-specific" style={{ width: `${v * 100}%` }} /></span>
                <span className="num text-right">{Math.round(v * 100)}%</span>
              </li>))}
          </ul>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Scenario editor</h2>
          <p className="text-xs text-muted">Override the earnings path and the distribution redraws from 1,000 cached paths, in your browser.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="eps" className="flex justify-between text-sm"><span>EPS against consensus</span><span className="num">{eps > 0 ? "+" : ""}{Math.round(eps * 100)}%</span></label>
              <input id="eps" type="range" min={-0.3} max={0.3} step={0.01} value={eps} onChange={(e) => setEps(+e.target.value)} className="mt-1 w-full accent-[rgb(var(--accent))]" />
              <p className="text-2xs text-muted">Mapped through the measured price elasticity to EBITDA growth ({engine.elasticity.toFixed(3)}). A low elasticity means a large EPS miss moves the median little: in this sector, earnings changes have explained little of the annual price move.</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noRer} onChange={(e) => setNoRer(e.target.checked)} /> Switch off P/E reversion to the 5-year norm</label>
          </div>
          {!redraw ? <p className="mt-4 text-sm text-muted">Loading cached paths…</p> : (
            <table className="tbl mt-4 text-sm">
              <thead><tr><th>1,000-path sample</th><th className="r">P10</th><th className="r">Median</th><th className="r">P90</th></tr></thead>
              <tbody>
                <tr><td className="text-muted">Published</td>{redraw.base.map((v, i) => <td key={i} className="r num text-muted">{pc(v)}</td>)}</tr>
                <tr><td className="font-medium">Your scenario</td>{redraw.adj.map((v, i) => <td key={i} className="r num font-medium">{pc(v)}</td>)}</tr>
              </tbody>
            </table>
          )}
          {redraw && <p className="mt-2 text-xs text-muted">P(beat market) in your scenario: <span className="num text-ink">{Math.round(redraw.beat * 100)}%</span>.</p>}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Calibration</h2>
          <p className="text-xs text-muted">Walk-forward probability integral transform: at each past quarter end, where did the realised return land in the band built from data known then? A calibrated 80% band holds about 80% of outcomes.</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {["3m", "12m"].map((k) => (
              <div key={k}>
                <div className="text-2xs text-muted">{k.toUpperCase()} · {calib[k].n} forecasts</div>
                <div className={`num text-[20px] ${Math.abs(calib[k].coverage_80 - 0.8) > 0.05 ? "text-warn" : "text-pos"}`}>{Math.round(calib[k].coverage_80 * 100)}% inside 80% band</div>
                <div className="text-2xs text-muted">Bands widened ×{calib.widen[k].toFixed(2)} in response</div>
              </div>))}
          </div>
          <div className="mt-8">
            <Chart title="PIT histogram 12M" height={160}
              option={{
                grid: { left: 36, right: 10, top: 10, bottom: 24 },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: ["0–.1", ".1–.2", ".2–.3", ".3–.4", ".4–.5", ".5–.6", ".6–.7", ".7–.8", ".8–.9", ".9–1"], axisLabel: { fontSize: 9 } },
                yAxis: { type: "value" },
                series: [{ type: "bar", data: calib["12m"].pit_hist, itemStyle: { color: "token:c-market" } }],
              }} />
            <p className="mt-1 text-2xs text-muted">Flat is calibrated. Heavy end bins mean realised returns fell outside the band more often than forecast.</p>
          </div>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">How the range is built</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>EPS paths centred on the Bloomberg mean, spread from this stock&apos;s history of earnings-growth errors (σ {Math.round(f.sd_eps * 100)}% a year).</li>
            <li>The price already reflects consensus, so only the surprise moves it: surprise × elasticity ({engine.elasticity.toFixed(3)}, bootstrapped).</li>
            <li>Forward P/E reverts to its 5-year norm at {((1 - engine.phi) * 100).toFixed(1)}% of the gap a month.</li>
            <li>Market, sector and style returns drawn in 21-day blocks from history, so crash months appear in the tails.</li>
            <li>Expected return = market beta × the market factor&apos;s historical return; the rest is noise.</li>
          </ol>
          <p className="mt-3 text-xs text-muted">Model history (past forecasts against outcomes) starts accruing with this snapshot. The Backtest Lab shows the P/E-reversion signal has not ranked {sectorNames[sectorOf[t]]} stocks well out of sample, so treat the median shift from re-rating with caution. Calibration and elasticity are estimated per sector.</p>
        </section>
      </div>
    </div>
  );
}
