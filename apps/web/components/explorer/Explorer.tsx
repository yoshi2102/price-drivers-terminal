"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Chart from "@/components/Chart";
import { fit, walkForward, pNorm, Obs } from "@/lib/ols";

type Panel = { columns: string[]; labels: Record<string, string>; groups: Record<string, string>; rows: any[][] };

export default function Explorer({ panel, names, sector }: { panel: Panel; names: Record<string, string>; sector: string }) {
  const col = (c: string) => panel.columns.indexOf(c);
  const drivers = Object.keys(panel.labels);
  const tickers = Object.keys(names);
  const [universe, setUniverse] = useState<string[]>(tickers);
  const [dep, setDep] = useState("y_window");
  const [sel, setSel] = useState<string[]>(["ebitda_margin_chg", "revenue_sue"].filter((d) => d in panel.labels));
  const [onlyDated, setOnlyDated] = useState(false);
  const [queued, setQueued] = useState<string | null>(null);

  useEffect(() => { // deep link: ?u=A,B&y=y_react&d=x,y&dated=1
    const q = new URLSearchParams(location.search);
    if (q.get("u")) setUniverse(q.get("u")!.split(",").filter((t) => tickers.includes(t)));
    if (q.get("y")) setDep(q.get("y")!);
    if (q.get("d")) setSel(q.get("d")!.split(",").filter((d) => drivers.includes(d)));
    if (q.get("dated") === "1") setOnlyDated(true);
  }, []); // eslint-disable-line
  const firstWrite = useRef(true);
  useEffect(() => {
    if (firstWrite.current) { firstWrite.current = false; return; } // let the parent read ?s= first
    const q = new URLSearchParams({ s: sector, u: universe.length === tickers.length ? "" : universe.join(","), y: dep, d: sel.join(","), dated: onlyDated ? "1" : "" });
    [...q.keys()].forEach((k) => !q.get(k) && q.delete(k));
    history.replaceState(null, "", `${location.pathname}?${q}`);
  }, [universe, dep, sel, onlyDated, tickers.length]);

  const result = useMemo(() => {
    if (!sel.length) return null;
    const rows = panel.rows.filter((r) => universe.includes(r[col("ticker")]) && (!onlyDated || r[col("date_source")] === "results_date"));
    const sd: Record<string, { m: number; s: number }> = {};
    sel.forEach((d) => {
      const v = rows.map((r) => r[col(d)]).filter((x) => x != null);
      const m = v.reduce((a, b) => a + b, 0) / v.length; sd[d] = { m, s: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(v.length - 1, 1)) || 1 };
    });
    const obs: Obs[] = rows.filter((r) => r[col(dep)] != null && sel.every((d) => r[col(d)] != null))
      .map((r) => ({ s: r[col("ticker")], t: r[col("tidx")], y: r[col(dep)], x: sel.map((d) => (r[col(d)] - sd[d].m) / sd[d].s) }));
    if (obs.length < sel.length + 10) return { obs, f: null as any, wf: null as any };
    const f = fit(obs); const wf = walkForward(obs);
    return { obs, f, wf };
  }, [universe, dep, sel, onlyDated]); // eslint-disable-line

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const depLabel: Record<string, string> = { y_react: "Reaction, day −1 to +3", y_drift: "Drift, day +4 to +60", y_window: "Full window, day −1 to +60" };

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-5">
        <fieldset className="rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Universe</legend>
          <div className="mb-2 flex gap-2 text-xs">
            <button className="text-accent hover:underline" onClick={() => setUniverse(tickers)}>Select all</button>
            <button className="text-accent hover:underline" onClick={() => setUniverse([])}>Clear</button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {tickers.map((t) => (
              <label key={t} className="flex min-h-[28px] items-center gap-2 text-xs">
                <input type="checkbox" checked={universe.includes(t)} onChange={() => toggle(universe, t, setUniverse)} className="accent-[rgb(var(--accent))]" />
                <span className="truncate" title={names[t]}>{names[t]}</span>
              </label>))}
          </div>
        </fieldset>
        <fieldset className="rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Dependent variable</legend>
          {Object.entries(depLabel).map(([v, l]) => (
            <label key={v} className="flex min-h-[28px] items-center gap-2 text-sm">
              <input type="radio" name="dep" checked={dep === v} onChange={() => setDep(v)} className="accent-[rgb(var(--accent))]" /> Stock-specific return, {l.toLowerCase()}
            </label>))}
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlyDated} onChange={(e) => setOnlyDated(e.target.checked)} /> Only quarters with an announced results date
          </label>
        </fieldset>
        <fieldset className="rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Candidate drivers</legend>
          {["KPI", "Surprise", "Street", "Macro", "Price"].map((g) => (
            <div key={g} className="mb-2">
              <div className="text-2xs text-muted">{g}</div>
              {drivers.filter((d) => panel.groups[d] === g).map((d) => (
                <label key={d} className="flex min-h-[26px] items-center gap-2 text-xs">
                  <input type="checkbox" checked={sel.includes(d)} onChange={() => toggle(sel, d, setSel)} className="accent-[rgb(var(--accent))]" /> {panel.labels[d]}
                </label>))}
            </div>))}
        </fieldset>
      </div>

      <div className="space-y-5">
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Joint regression</h2>
              <p className="text-xs text-muted">Stock fixed effects; standard errors clustered by stock. Coefficients are per 1 SD of each driver, in % return.</p>
            </div>
            <button onClick={() => {
              const id = `HYP-${Date.now().toString(36).toUpperCase()}`;
              try { const q = JSON.parse(localStorage.getItem("pdt.queue") || "[]"); q.push({ id, universe, dep, drivers: sel, at: new Date().toISOString() }); localStorage.setItem("pdt.queue", JSON.stringify(q)); } catch {}
              setQueued(id);
            }} className="h-8 rounded-card bg-ink px-3 text-xs font-medium text-paper hover:opacity-90">Queue registered run</button>
          </div>
          {queued && <p className="mt-2 text-xs text-pos">Queued {queued}. The worker picks it up on the next run and logs it in the experiment registry, so the multiple-testing count includes it.</p>}
          {!result?.f ? (
            <p className="mt-4 text-sm text-muted">Not enough complete observations ({result?.obs.length ?? 0}). Add stocks or drop a driver with sparse data (KPI drivers such as tonnes or deal TCV cover fewer stocks and quarters).</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[["Observations", result.f.n], ["Stocks", result.f.groups], ["Within R², in-sample", (result.f.r2 * 100).toFixed(1) + "%"],
                  ["Out-of-sample R², pooled", result.wf.pooled == null ? "—" : (result.wf.pooled * 100).toFixed(1) + "%"]].map(([l, v]) => (
                  <div key={l as string}><div className="text-2xs text-muted">{l}</div><div className={`num text-[18px] ${typeof v === "string" && v.startsWith("-") ? "text-neg" : ""}`}>{v}</div></div>))}
              </div>
              <div className="-mx-4 mt-4 overflow-x-auto">
                <table className="tbl text-sm">
                  <thead><tr><th>Driver</th><th className="r">Coef. per 1 SD</th><th className="r">Clustered SE</th><th className="r">t</th><th className="r">p (unadjusted)</th></tr></thead>
                  <tbody>{sel.map((d, i) => {
                    const b = result.f.b[i] * 100, se = result.f.se[i] * 100, t = b / se;
                    return (<tr key={d}><td>{panel.labels[d]}</td><td className={`r num ${Math.abs(t) > 1.65 ? (b > 0 ? "text-pos" : "text-neg") : ""}`}>{b > 0 ? "+" : ""}{b.toFixed(2)}%</td>
                      <td className="r num text-muted">{se.toFixed(2)}</td><td className="r num">{t.toFixed(2)}</td><td className="r num">{pNorm(t).toFixed(3)}</td></tr>);
                  })}</tbody>
                </table>
              </div>
              <p className="mt-2 text-2xs text-muted">Exploratory: computed in your browser and not counted in the experiment registry. p-values here are not corrected for the {Object.keys(panel.labels).length} drivers on offer; use “Queue registered run” for a result that counts.</p>
            </>
          )}
        </section>
        {result?.wf?.folds?.length ? (
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-[15px] font-semibold">Walk-forward folds</h2>
            <p className="text-xs text-muted">Each bar: out-of-sample R² in one test quarter, trained on all earlier quarters minus a one-quarter embargo. {result.wf.folds.filter((x: number) => x > 0).length} of {result.wf.folds.length} folds beat the stock-mean baseline.</p>
            <div className="mt-8">
              <Chart title="Out-of-sample R² by fold" height={200} n={`${result.wf.folds.length} folds`}
                option={{
                  grid: { left: 44, right: 10, top: 10, bottom: 24 },
                  tooltip: { trigger: "axis", valueFormatter: "fmt:pct1" },
                  xAxis: { type: "category", data: result.wf.folds.map((_: any, i: number) => `F${i + 1}`) },
                  yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
                  series: [{ type: "bar", data: result.wf.folds.map((v: number) => ({ value: +(v * 100).toFixed(1), itemStyle: { color: v > 0 ? "token:pos" : "token:neg" } })) }],
                }}
                table={{ columns: ["Fold", "OOS R² %"], rows: result.wf.folds.map((v: number, i: number) => [`F${i + 1}`, +(v * 100).toFixed(2)]) }} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
