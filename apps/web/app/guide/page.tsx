import Link from "next/link";
import { Fragment, ReactNode } from "react";
import { PageHead, Note, Badge } from "@/components/ui";
import { load, manifest } from "@/lib/data";
import { pct, fmtDate } from "@/lib/format";

export const metadata = { title: "Guide" };

const TOC: [string, string][] = [
  ["flow", "How a number reaches the screen"],
  ["data", "The data and the known-at rule"],
  ["factor", "Factor model"],
  ["drivers", "Driver tests and the six gates"],
  ["events", "Event studies"],
  ["brokers", "Broker scorecard"],
  ["forward", "Forward paths"],
  ["backtest", "Backtest lab"],
  ["screens", "Screen by screen"],
  ["labels", "Reading the labels"],
  ["results", "What the pilot found"],
  ["next", "Next steps"],
  ["glossary", "Glossary"],
];

function S({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-8 first:border-0 first:pt-0">
      <h2 className="font-display text-[24px] leading-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.65] text-ink/90 [&_p]:max-w-[72ch]">{children}</div>
    </section>
  );
}
const F = ({ children }: { children: ReactNode }) => (
  <pre className="overflow-x-auto rounded-card border border-line bg-sunk/60 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink">{children}</pre>
);
const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <figure className="my-2 overflow-hidden rounded-card border border-line">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} width={1440} height={900} loading="lazy" className="h-auto w-full" />
    <figcaption className="border-t border-line bg-surface px-3 py-1.5 text-2xs text-muted">{alt}</figcaption>
  </figure>
);

function Pipeline() {
  const box = (x: number, y: number, w: number, t: string, s: string, accent = false) => (
    <g>
      <rect x={x} y={y} width={w} height={58} rx={6} fill={accent ? "rgb(var(--accent) / 0.08)" : "rgb(var(--surface))"} stroke={accent ? "rgb(var(--accent))" : "rgb(var(--line))"} />
      <text x={x + 12} y={y + 24} fontSize={13} fontWeight={600} fill="rgb(var(--ink))">{t}</text>
      <text x={x + 12} y={y + 43} fontSize={11} fill="rgb(var(--muted))">{s}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--muted))" strokeWidth={1.25} markerEnd="url(#ah)" />
  );
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper p-3">
      <svg viewBox="0 0 980 250" width="100%" style={{ minWidth: 760 }} role="img" aria-label="Data flows from Airavat and broker notes into raw files, through the Python worker's validate and model stages, into a published snapshot that the website reads.">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--muted))" /></marker></defs>
        {box(10, 20, 180, "Airavat", "prices, financials, consensus")}
        {box(10, 96, 180, "Report library", "broker notes, transcripts")}
        {box(10, 172, 180, "Commodity series", "coal, pet coke, Brent, INR")}
        {box(250, 96, 150, "Raw files", "pdt-raw/, as returned")}
        {box(450, 20, 220, "1 · Ingest", "point-in-time tables, known_at")}
        {box(450, 96, 220, "2 · Validate", "7 quality rules, flag not drop")}
        {box(450, 172, 220, "3 · Model", "factor, drivers, events, MC")}
        {box(730, 96, 230, "Published snapshot", "JSON + code hash + data hash", true)}
        {arrow(190, 49, 250, 118)}{arrow(190, 125, 250, 125)}{arrow(190, 201, 250, 132)}
        {arrow(400, 118, 450, 52)}{arrow(560, 78, 560, 96)}{arrow(560, 154, 560, 172)}
        {arrow(670, 201, 730, 135)}
        <text x={735} y={190} fontSize={11} fill="rgb(var(--muted))">website reads only this;</text>
        <text x={735} y={205} fontSize={11} fill="rgb(var(--muted))">pointer moves only if every</text>
        <text x={735} y={220} fontSize={11} fill="rgb(var(--muted))">stage passed</text>
      </svg>
    </div>
  );
}

export default function Guide() {
  const m = manifest();
  const s = load("sector_cement.json");
  const h = load("health.json");
  const e = load("events.json");
  const b = load("backtest.json");
  const fw = load("forward.json");
  const A = m.params.acceptance;
  const tested = (s.leaderboard as any[]).filter((r) => r.status !== "insufficient");
  const best = [...tested].filter((r) => r.p != null).sort((a, c) => a.p - c.p)[0];
  const cov = h.coverage as any[];
  const withDates = cov.filter((c) => c.datasets.results_dates.n > 0).length;
  const withVol = cov.filter((c) => c.datasets.kpi_volume.n > 1).length;
  return (
    <>
      <PageHead kicker="Help" title="How the terminal works"
        meta={<span className="font-mono">snapshot {m.snapshot_id} · prices to {m.as_of}</span>}>
        Every figure, test and screen, explained from the raw data up. Numbers on this page are read from the current snapshot, so they stay in step with the rest of the app.
      </PageHead>
      <div className="grid gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Guide contents" className="hidden xl:block">
          <ol className="sticky top-20 space-y-1 text-sm">
            {TOC.map(([id, t]) => <li key={id}><a href={`#${id}`} className="block rounded-chip px-2 py-1 text-muted hover:bg-sunk hover:text-ink">{t}</a></li>)}
          </ol>
        </nav>
        <article className="min-w-0 space-y-10">

          <S id="flow" title="How a number reaches the screen">
            <p>The website never computes anything. A Python worker pulls data, checks it, runs every model and writes the results to a folder of JSON files called a snapshot. The website reads the latest published snapshot and draws it. That split is why a page renders in a fraction of a second, and why any number can be traced to one run.</p>
            <Pipeline />
            <p>Each snapshot records three fingerprints: the code hash ({m.code_hash}), the data hash ({m.data_hash}) and the run parameters. Re-running the same code on the same raw files gives the same numbers, down to the Monte Carlo draws, because the random seed ({m.params.seed}) is fixed. The last full run took {m.runtime_seconds} seconds. If any stage fails, the published pointer does not move and the site keeps showing the last good snapshot.</p>
          </S>

          <S id="data" title="The data and the known-at rule">
            <p>Every stored fundamental carries two dates: the period it describes and <b>known_at</b>, the first day the market could have known it. A model asking for data &ldquo;as of 30 June 2024&rdquo; gets only rows with known_at on or before that day. This is what keeps backtests honest: no model can use a quarter&apos;s results before they were announced.</p>
            <p>Where the announcement date is on file, known_at is that date. Where it is not, known_at is the quarter end plus 45 days (60 for the March quarter), the SEBI filing deadline. The fallback can only make data arrive late, never early. Today {s.date_basis.results_date} of {s.panel_n} stock-quarters use a real date and {s.date_basis.fallback_lag} use the fallback.</p>
            <div className="overflow-x-auto">
              <table className="tbl text-sm">
                <thead><tr><th>Dataset</th><th>Source</th><th>Coverage now</th></tr></thead>
                <tbody>
                  <tr><td>Daily prices</td><td>Airavat get_price_history</td><td>12 cement stocks from Apr 2015 (later for listings after that); 16 large caps for the market factor</td></tr>
                  <tr><td>Quarterly financials</td><td>Airavat get_financials (ACE Equity fallback for 11 stocks); before FY21, company decks, broker notes and call remarks</td><td>FY21 onward for all; back to FY16–FY18 for UltraTech, ACC, Ambuja, Star and JK Lakshmi; thin before FY21 for the rest</td></tr>
                  <tr><td>Sales volumes</td><td>Company decks, Motilal Oswal results tables</td><td>{withVol} of 12 stocks</td></tr>
                  <tr><td>Results dates</td><td>Board-meeting letters, results presentations, earnings-call transcripts (call dates usually fall on results day or the next)</td><td>{withDates} of 12 stocks; Shree has none usable</td></tr>
                  <tr><td>Consensus</td><td>Bloomberg via Airavat get_consensus_estimates</td><td>Current snapshot plus 12 months of revision dates; pre-results street expectations (Centrum, Axis, Kotak previews) for FY25Q3 and FY26Q2–FY27Q2</td></tr>
                  <tr><td>Broker estimates</td><td>Extracted from notes in the report library</td><td>UltraTech, 116 notes from Jan 2024; 90 estimates scored against reported EPS</td></tr>
                  <tr><td>Commodities</td><td>Kotak series via Airavat</td><td>Pet coke, Indonesian and Richards Bay coal, Brent, INR/USD, daily</td></tr>
                </tbody>
              </table>
            </div>
            <p>The PRD defines seven load rules; four have data to act on today. Quarters must sum to the year within 0.5%. EPS times implied shares must match PAT within 1%, checked quarter on quarter so a real share issue flags once. No one-day price move above 35% may go unexplained. Broker rows below 0.8 extraction confidence go to review. (The other three cover consensus FY labels, macro vintages and delisted stocks, which arrive with Tijori and deeper history.) Every break is flagged on <Link href="/health" className="text-accent hover:underline">Data health</Link> and kept, never silently dropped.</p>
          </S>

          <S id="factor" title="Factor model: splitting each day's return">
            <p>Each stock&apos;s daily log return is regressed on four factors, re-estimated every {m.params.refit_days} trading days using only the previous {m.params.factor_window} days (about two years). The fitted betas are then applied to the next 21 days, so a day&apos;s residual never uses information from that day or later.</p>
            <F>{`r(stock) − rf = α + β_M·Market + β_S·Sector + β_mom·Momentum + β_lv·LowVol + ε

Market   = equal-weighted 16 large caps (Airavat holds no index series)
Sector   = other 11 cement stocks, equal weight, minus Market   (leave-one-out)
Momentum = top third minus bottom third by 12-1 month return, rebalanced monthly
LowVol   = lowest third minus highest third by 1-year volatility
ε        = stock-specific return`}</F>
            <p>Summing the pieces over any window gives the attribution waterfall on the Stock page. The variance shares on Home and Sector come from the same split over the last three years: each component&apos;s covariance with the total return, divided by the total variance. The factor covariance matrix is shrunk with Ledoit-Wolf (shrinkage {s.factor_cov.shrinkage}) for the forward simulation.</p>
            <p><b>Earnings or re-rating.</b> The log price change over a window splits exactly into the change in trailing EPS and the change in P/E: ln(P₁/P₀) = ln(E₁/E₀) + ln(PE₁/PE₀). It is left blank when EPS is negative at either end. EPS is as reported, so one-off gains show up as &ldquo;earnings&rdquo;.</p>
          </S>

          <S id="drivers" title="Driver tests and the six gates">
            <p>A driver is any number that might explain price moves: a KPI (volume growth, realisation per tonne, cost per tonne, EBITDA per tonne), a surprise (revenue, EBITDA or PAT against the stock&apos;s own trend), a commodity change, or the prior three months&apos; return. Four KPIs were pre-registered from the Buoyant cement sector skill before any test ran; the rest are a discovery set.</p>
            <p>The question each test answers: when this driver is one standard deviation higher, how much higher is the stock-specific return from the day before results to 60 trading days after?</p>
            <F>{`y(stock, quarter) = stock effect + quarter effect + b · z(driver) + error

y        = sum of daily ε from day −1 to +60 around results
z        = driver in standard-deviation units
SE       = clustered by stock and by quarter (two-way)
Macro drivers drop the quarter effect, which would absorb them.`}</F>
            <p>A driver is labelled <Badge kind="validated" /> only if it passes all six gates:</p>
            <div className="overflow-x-auto">
              <table className="tbl text-sm">
                <thead><tr><th>Gate</th><th>Test</th><th>Why it exists</th></tr></thead>
                <tbody>
                  <tr><td>Sign</td><td>Effect has the sign the sector skill predicts</td><td>A cost driver that &ldquo;helps&rdquo; returns is more likely noise than insight</td></tr>
                  <tr><td>False discovery</td><td>Benjamini-Hochberg q below {A.bh_q} across all {tested.length} drivers tested</td><td>Test 15 random series and one will look significant by luck</td></tr>
                  <tr><td>Out of sample</td><td>Adds R² in at least {A.oos_fold_share * 100}% of walk-forward folds</td><td>Each fold trains only on earlier quarters, skips one quarter, then predicts the next</td></tr>
                  <tr><td>Regimes</td><td>Same sign in at least 3 of 4 regimes</td><td>Pre-COVID, COVID, 2022 rate hikes, post-2023</td></tr>
                  <tr><td>Placebo</td><td>Real effect beats the {A.placebo_pct}th percentile of 300 shuffles</td><td>Shuffling the driver within each stock breaks timing but keeps its distribution</td></tr>
                  <tr><td>Sample</td><td>At least {A.min_stocks} stocks and {A.min_obs} stock-quarters</td><td>Below this, one stock can carry the whole result</td></tr>
                </tbody>
              </table>
            </div>
            <p>Every test is logged in the append-only experiment registry on the Backtest lab, with its raw and adjusted p-value. Analysts can run their own combinations in the <Link href="/attribution" className="text-accent hover:underline">Attribution explorer</Link>; those runs are exploratory until queued as registered runs, so the multiple-testing count stays honest.</p>
            <p><b>Per-stock effects.</b> A single stock has about 20 quarters, too few for its own estimate. The Stock page shows each stock&apos;s effect shrunk toward the sector estimate in proportion to how noisy it is (empirical Bayes). &ldquo;Own-data weight&rdquo; says how much of the number comes from the stock itself; near 0% means the stock&apos;s history is indistinguishable from the sector&apos;s.</p>
            <p><b>Discovery models.</b> Elastic net and LightGBM are fitted over all drivers plus one- and two-quarter lags, on purged walk-forward folds. The tree model is kept only if it beats the linear model out of sample by more than 0.02 R². SHAP values show what the tree relied on.</p>
          </S>

          <S id="events" title="Event studies">
            <p>For each results announcement with a known date, the stock-specific return is cumulated from 5 days before to 60 days after. Events are sorted into five buckets by surprise size, and the average path of each bucket is drawn. If surprises matter, the most-positive bucket rises and the most-negative falls around day 0.</p>
            <F>{`Surprise (SUE) = (YoY growth this quarter − average YoY growth of the previous 4 quarters)
                 ÷ standard deviation of past surprises
Reaction       = days −1 to +3
Drift          = days +4 to +60   (does the move continue after the news is out?)`}</F>
            <p>Two kinds of surprise are tested. The own-trend surprise (SUE) covers every quarter. The street surprise compares the result with broker previews and Bloomberg consensus published before results, but exists only for about six recent quarters. Significance uses Patell and BMP tests, and confidence bands come from a bootstrap that resamples whole results weeks, because cement companies report in the same few weeks and their returns move together. {e.n_real_dates} stock-quarters currently have a usable date.</p>
          </S>

          <S id="brokers" title="Broker scorecard">
            <p>Each broker estimate is compared with the reported actual for that year. Errors are adjusted for horizon (a forecast made in March is easier than one made a year earlier), and each broker&apos;s average error is shrunk toward the all-broker average in proportion to how few estimates it has. Weights for the Buoyant consensus are proportional to the inverse of expected squared error, capped at 25% per broker, with notes older than 90 days halved.</p>
            <p>The weighted consensus replaces the plain mean only if it wins a Diebold-Mariano test at 5% on walk-forward months. Today it cannot be tested: almost every extracted note forecasts FY27 to FY29, which have no actuals yet. The screen shows current views, dispersion and the weighted-versus-plain comparison, with the accuracy columns waiting for older notes.</p>
          </S>

          <S id="forward" title="Forward paths">
            <p>For each stock the engine simulates 10,000 paths for 3, 6 and 12 months. The price already reflects consensus, so consensus growth sets the centre of the earnings path but does not by itself move the price. Only a surprise against it does.</p>
            <F>{`log return = market beta × market expected return          (required return)
           + EPS surprise × price elasticity                (elasticity ${fw.engine.elasticity.toFixed(3)}, bootstrapped)
           + (1 − e^(−κ·months)) × ln(fair P/E ÷ current P/E) (reversion, κ from φ = ${fw.engine.phi.toFixed(3)} a month)
           + market, sector and style moves in 21-day blocks of history
           + stock-specific noise`}</F>
            <p>Current P/E uses 12-month-forward Bloomberg EPS. Fair P/E is the five-year median of price over the EPS reported 12 months later, which strips one-off gains from the comparison. Block bootstrapping keeps crash months intact, so the tails include real drawdowns.</p>
            <p><b>Calibration.</b> At every past quarter end, a band was built from data known then and checked against what happened. A good 80% band holds about 80% of outcomes. Three-month bands held {pct(fw.calibration["3m"].coverage_80, 0, false)}; twelve-month bands held {pct(fw.calibration["12m"].coverage_80, 0, false)}, so twelve-month spreads are widened ×{fw.calibration.widen["12m"].toFixed(2)}. The tornado shows how far the median moves when one input goes to its 10th or 90th percentile. The scenario editor shifts the earnings path and redraws from 1,000 cached paths in your browser.</p>
          </S>

          <S id="backtest" title="Backtest lab">
            <p>At each month end, each model version ranks the cement stocks using only data known then. Rank IC is the correlation between that ranking and the next three months&apos; return relative to the cement average. A useful signal has IC above 0.05, steadily. Newey-West t-stats allow for overlapping three-month windows; the deflated Sharpe adjusts the long-short result for the {(load("registry.json") as any[]).length} hypotheses tried. fp-1.0 uses P/E reversion plus the strongest drivers; fp-0.9 is P/E reversion alone, as a control. Both are scored on the same {b.versions["fp-1.0"].n_months} months.</p>
          </S>

          <S id="screens" title="Screen by screen">
            {[
              ["Home", "/", "Sector grid (return against market, variance split, drivers turning), alerts, FY1 EPS revision breadth, the gap between revisions and price, commodities.", "/guide/01-home.png", "Home: sector grid and alerts at the top"],
              ["Sector", "/sector/cement", "Driver leaderboard with intervals and gate squares, return decomposition by quarter, earnings against re-rating, peer table, regime view, valuation bands, discovery models.", "/guide/02-sector-cement.png", "Sector: the leaderboard is the page's main table"],
              ["Stock", "/stock/ULTRACEMCO", "Header with price, valuation and street view; return waterfall for 1, 3 and 12 months; driver panel; KPI history against price; consensus and revisions; results timeline with surprise and reaction for each quarter.", "/guide/03-stock-ultratech.png", "Stock: header, waterfall and price history"],
              ["Forward paths", "/forward", "One-line summary, fan chart in rupees, tornado, bull/base/bear table, variance sources, scenario editor, calibration.", "/guide/04-forward-paths.png", "Forward paths: the summary sentence states the range"],
              ["Event studies", "/events", "Average post-results paths by surprise bucket, reaction and drift tests, before and after 2023, and the event list.", "/guide/05-event-studies.png", "Event studies, dark theme"],
            ].map(([t, href, d, img, alt]) => (
              <div key={t} className="space-y-2">
                <h3 className="text-[16px] font-semibold"><Link href={href} className="hover:text-accent">{t}</Link></h3>
                <p>{d}</p>
                <Shot src={img} alt={alt} />
              </div>
            ))}
            <div className="overflow-x-auto">
              <table className="tbl text-sm">
                <thead><tr><th>Screen</th><th>Use it to</th></tr></thead>
                <tbody>
                  <tr><td><Link className="text-accent hover:underline" href="/attribution">Attribution explorer</Link></td><td>Pick stocks, a window and drivers; the joint regression and walk-forward folds re-run in the browser.</td></tr>
                  <tr><td><Link className="text-accent hover:underline" href="/brokers">Broker scorecard</Link></td><td>Compare each broker&apos;s latest view with the Bloomberg mean; see dispersion and estimate paths.</td></tr>
                  <tr><td><Link className="text-accent hover:underline" href="/backtest">Backtest lab</Link></td><td>Check whether any signal ranks stocks out of sample; read the experiment registry.</td></tr>
                  <tr><td><Link className="text-accent hover:underline" href="/health">Data health</Link></td><td>See coverage by stock and dataset, every rule that fired, and the run log.</td></tr>
                  <tr><td><Link className="text-accent hover:underline" href="/studio">Research studio</Link></td><td>Collect pinned charts into a pack and move it through compliance status.</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="text-[16px] font-semibold">Controls on every page</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>⌘K or Ctrl+K</b> opens search for any company, NSE code or screen.</li>
              <li><b>Dotted underline</b> on a number: hover or tab to it to see its source tag.</li>
              <li><b>Table</b> above a chart swaps it for the data. <b>Export</b> saves PNG, slide-ready SVG or CSV. <b>Pin</b> sends it to Research studio.</li>
              <li><b>Links keep state.</b> Forward paths, Event studies and the explorer write their settings into the address, so a copied link opens the same view.</li>
              <li><b>Theme</b>: the moon or sun button switches light and dark.</li>
            </ul>
          </S>

          <S id="labels" title="Reading the labels">
            <div className="overflow-x-auto">
              <table className="tbl text-sm">
                <tbody>
                  <tr><td className="w-[160px]"><Badge kind="validated" /></td><td>Passed all six gates. Safe to cite internally with its interval.</td></tr>
                  <tr><td><Badge kind="unvalidated" /></td><td>Tested and failed at least one gate. Hover the gate squares on the Sector page to see which.</td></tr>
                  <tr><td><Badge kind="unstable" /></td><td>Changes sign across regimes. Whatever it did once, it has not kept doing.</td></tr>
                  <tr><td><Badge kind="stable" /> <Badge kind="regime-dependent" /></td><td>Stability badge: same sign in every regime tested, or in most of them.</td></tr>
                  <tr><td><span className="text-2xs text-warn">est.</span></td><td>Results date is the filing-deadline fallback, not the real date.</td></tr>
                </tbody>
              </table>
            </div>
            <p>&ldquo;No driver validated&rdquo; is a finding. It says the KPI set tested so far does not explain cement price moves reliably with the history available, and the app is built to show that rather than promote a lucky correlation.</p>
          </S>

          <S id="results" title="What the pilot found">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{tested.filter((r) => r.validated).length} of {tested.length} drivers validated. The strongest, {best?.label.toLowerCase()}, has p = {best?.p?.toFixed(3)} and q = {best?.q?.toFixed(2)} after correction.</li>
              <li>Stock-specific moves are {pct(s.share_explained.specific, 0, false)} of daily variance; market {pct(s.share_explained.market, 0, false)}, style {pct(s.share_explained.style, 0, false)}, sector {pct(s.share_explained.sector, 0, false)}.</li>
              <li>Elastic net shrinks every coefficient to zero; LightGBM fails out of sample and is not used.</li>
              <li>No surprise metric shows reliable drift after day +3.</li>
              <li>Backtest rank IC: {b.versions["fp-1.0"].ic_mean.toFixed(3)} for fp-1.0 and {b.versions["fp-0.9"].ic_mean.toFixed(3)} for the control, against a target of 0.05.</li>
            </ul>
            <p>Extending the data (results dates for 11 stocks, history back to FY16, street expectations, older broker notes) moved EBITDA margin change from nowhere to five of six gates. It fails only the out-of-sample gate: it beats the baseline in 46% of walk-forward quarters against the 70% required. Revenue against street expectations shows post-results drift whose interval excludes zero, but on just 44 events.</p>
          </S>

          <S id="next" title="Next steps">
            <p>In order. The first block decides whether the pilot can pass at all; the rest builds on a pass.</p>
            <h3 className="text-[16px] font-semibold">1. Close what Airavat could not supply</h3>
            <p>Results dates, volumes, history back to FY16, street previews and older UltraTech broker notes have now been extracted from Airavat. What remains is not in the library:</p>
            <div className="overflow-x-auto">
              <table className="tbl text-sm">
                <thead><tr><th>Gap</th><th>Owner</th><th>What it changes</th></tr></thead>
                <tbody>
                  <tr><td>Board-meeting dates for Shree Cement (only call dates, 4–6 days late, are in the library) and exact dates where only call dates exist</td><td>Labs (BSE/NSE announcement feed)</td><td>Shree enters the event studies; reaction windows tighten for 7 stocks</td></tr>
                  <tr><td>Bloomberg quarterly consensus history before 2025 (previews start Jan 2025)</td><td>Labs</td><td>Street surprise on 300+ stock-quarters instead of about 55</td></tr>
                  <tr><td>Quarterly results FY16–FY20 for Shree, Dalmia, JK Cement, Ramco, Birla, Heidelberg (no filings or notes in the library)</td><td>Labs (results filings) or ACE history</td><td>Pre-COVID regime for the whole sector, not just four stocks</td></tr>
                  <tr><td>Broker notes for the other 11 stocks</td><td>Extraction job, 200-note audit</td><td>Broker scorecard beyond UltraTech</td></tr>
                  <tr><td>NSE index files</td><td>IT</td><td>A real market factor instead of the 16-stock basket</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="text-[16px] font-semibold">2. Fix the pass/fail rule before re-running (week 4)</h3>
            <p>Write down the go/no-go test now, so the result cannot be argued after the fact. Proposed: <b>go</b> if at least two drivers validate on 8 or more stocks, twelve-month bands hold 75–85% of outcomes, and rank IC is at least 0.05 over 36 or more months with the same sign in 3 regimes. If it fails with the full data, the cement answer is that price moves are mostly stock-specific news, and the product leans on event monitoring, revisions and broker views rather than KPI attribution.</p>
            <h3 className="text-[16px] font-semibold">3. Put two PMs on it (weeks 4–6)</h3>
            <p>Give each PM the five representative questions from the PRD and log whether the app answers each in under a minute. Track what they open, what they export and what they ask for that is missing. That list sets the rollout backlog.</p>
            <h3 className="text-[16px] font-semibold">4. Second sector: IT services</h3>
            <p>Airavat&apos;s searchable store already indexes more than ten IT and engineering-services names, with transcripts and broker notes, so results dates and KPIs (constant-currency growth, deal wins, margins, headcount) are cheap to extract. Private banks, the PRD&apos;s other candidate, are not in that store and would need far more manual reading. IT services also stress-tests the method on a sector where the drivers are better understood.</p>
            <h3 className="text-[16px] font-semibold">5. Production setup</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Vercel: import the GitHub repository, set root to <span className="font-mono">apps/web</span>, set <span className="font-mono">PDT_ACCESS_PASSWORD</span> until SSO is decided. Without it, every page returns an error by design.</li>
              <li>SSO: choose Google Workspace or Microsoft Entra and add the four Auth.js variables.</li>
              <li>Storage: a Mumbai-region bucket for snapshots (then remove the data from git) and Postgres from <span className="font-mono">db/schema.sql</span> for users, packs and the registry.</li>
              <li>Scheduling: Airavat service keys from Labs, then the worker runs on Modal or a Buoyant VM on the PRD&apos;s timetable.</li>
              <li>Licensing: confirm with the Bloomberg account manager that internal web display of consensus is covered.</li>
            </ul>
          </S>

          <S id="glossary" title="Glossary">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
              {[
                ["Stock-specific return", "What is left after removing market, sector and style moves (the factor model residual)."],
                ["SUE", "Standardised unexpected earnings: growth surprise divided by its usual size."],
                ["CAR", "Cumulative abnormal return: stock-specific return added up over an event window."],
                ["Incremental R²", "Extra share of variance explained when the driver is added."],
                ["Walk-forward fold", "Train on everything before a quarter, skip one quarter, test on the next."],
                ["BH q-value", "p-value adjusted for the number of drivers tested (Benjamini-Hochberg)."],
                ["Placebo", "The same test with the driver's dates shuffled; the real effect should beat it."],
                ["Shrinkage", "Pulling a noisy estimate toward a group average, more when data is thin."],
                ["Rank IC", "Correlation between a signal's ranking of stocks and their later returns."],
                ["Deflated Sharpe", "Probability that a Sharpe ratio is real after counting how many strategies were tried."],
                ["PIT test", "Checks whether outcomes land across a forecast distribution as often as it claims."],
                ["known_at", "First date the market could know a value; models never read past it."],
              ].map(([k, v]) => (<Fragment key={k}><dt className="font-medium">{k}</dt><dd className="text-muted">{v}</dd></Fragment>))}
            </dl>
            <Note>Last updated with snapshot {m.snapshot_id}, created {fmtDate(m.created_at?.slice(0, 10))}.</Note>
          </S>
        </article>
      </div>
    </>
  );
}
