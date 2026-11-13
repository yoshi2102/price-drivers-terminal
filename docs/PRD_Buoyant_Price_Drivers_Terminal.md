# PRD: Buoyant Price Drivers Terminal

Nov 13, 2026 · @Yash Palod

## Summary and goals

The Price Drivers Terminal is a web app, deployed on Vercel behind Buoyant sign-in, that shows for every covered stock and sector which data actually explains its price moves, and what that implies for the next 3 to 12 months. It turns Airavat, Bloomberg consensus (via Airavat), Tijori and broker research into one point-in-time dataset, runs validated statistical models on it, and presents the results as screens PMs, analysts and the sales team can use and share.

### Problem

- Buoyant has rich data (financials, deck KPIs, transcripts, broker notes, Bloomberg consensus, flows, macro) but no systematic answer to "what moves this stock?"
- Views on drivers are anecdotal and differ by analyst; nobody can show the evidence or how stable it is.
- Bloomberg consensus weights every broker equally, though some houses are far more accurate on specific sectors.
- Forward views are single-point targets, not probability ranges tied to the KPIs that matter.

### Goals

1. **Attribution:** for each sector and stock, rank the KPIs, surprises, revisions and macro variables that explain price moves, with effect sizes, confidence intervals and regime stability.
2. **Broker accuracy:** score every research house by sector and company, and build a Buoyant-weighted consensus.
3. **Forward paths:** combine attribution and weighted consensus into probability ranges for 3, 6 and 12-month returns, with the 2 to 3 KPIs that drive each case.
4. **Trust:** every number is point-in-time, sourced and reproducible; every model shows its out-of-sample record.
5. **Distribution:** one shareable link, fast enough for a PM meeting, with exportable charts for internal notes and client material.

### Non-goals (v1)

- No trade execution, order management or portfolio rebalancing.
- No intraday or high-frequency signals; daily data is the finest grain.
- No client logins; external clients see exported material, not the app.
- No live Bloomberg terminal integration beyond the Airavat feed.

### Success metrics

| Metric | Target | Measured by |
| --- | --- | --- |
| Variance of stock-specific returns explained, pilot sector | Reported honestly; aim for 25% or more out-of-sample at quarterly horizon | Walk-forward backtest |
| Rank IC of 3-month forward return forecast | 0.05 or higher, stable across 3 of 4 regimes | Backtest Lab |
| Weighted consensus vs plain Bloomberg mean | Lower forecast error on FY1 EPS in 60%+ of stock-years | Broker Scorecard backtest |
| Data freshness after results | Stock updated within 48 hours of results filing | Data Health page |
| Adoption | Weekly use by all PMs and 80% of analysts within 2 months of pilot | Usage logs |
| Page load | Under 2 seconds for sector and stock pages | Vercel analytics |

## Users and jobs to be done

Four user groups share one app; each sees the same data with different default views and permissions.

| User | Core job | Key screens | Permission |
| --- | --- | --- | --- |
| Jigar / CIO | See which sectors and holdings have drivers turning, and where the street is wrong | Home, Sector, Forward Paths | Admin |
| Portfolio managers | Decide sizing: what moves this stock, what is priced in, what range of outcomes is likely | Stock, Forward Paths, Broker Scorecard | Editor |
| Analysts | Test driver hypotheses, check results reactions, maintain sector KPI lists | Attribution, Event Studies, Backtest Lab, Data Health | Editor |
| Sales team | Pull approved charts and talking points for client meetings | Research Studio (approved exports only) | Viewer |

### Representative questions the app must answer in under a minute

- "Over the last 5 years, what explains most of UltraTech's stock-specific move: volumes, realisation per tonne, cost per tonne or consensus revisions?"
- "Which brokers have been most accurate on private bank FY1 EPS, and what does their weighted consensus say vs Bloomberg?"
- "After a 5% EBITDA miss, how does a typical IT services stock trade over the next 60 days, and has that changed since 2023?"
- "What is the probability range for HDFC Bank's 12-month return, and which two KPIs move that range most?"
- "Which holdings have had the largest gap between consensus revisions and price moves this quarter?"

## Product scope and module map

The terminal has four layers: data sources, a point-in-time warehouse, four model engines, and ten screens. Models run offline and write results; the app only reads them, which keeps pages fast and every number reproducible.

&#91;embedded content: module map · 5 sources, 4 engines, 10 screens\]

Forward Paths is the product's headline output and depends on both Attribution and Broker Accuracy; Validation gates every engine before its results reach a screen.

## Functional requirements by screen

The app has ten screens. Every chart and table shows its as-of date, source tags and sample size, and exports to PNG, CSV and slide-ready SVG. Requirements are tagged **P0** (pilot), **P1** (rollout) or **P2** (later).

### 1. Home (Market and Portfolio Pulse)

- **P0** Sector grid: for each covered sector, 1M/3M/12M return vs Nifty, share explained by market/sector/style/specific, and a "drivers turning" flag when a top-3 KPI moved more than 1 standard deviation this quarter.
- **P0** Revision breadth: share of stocks with FY1 EPS upgrades vs downgrades over 1 and 3 months, by sector.
- **P1** Flows and macro strip: FII/DII and MF flows, CPI, IIP, GST, PMI, credit growth, 10Y G-sec, INR, Brent, with each series' last release date.
- **P1** Holdings overlay: portfolio weights against model expected-return ranges (needs holdings upload; see Open questions).
- **P1** Alerts feed: stocks whose price has moved outside the model's expected band, or whose key KPI or consensus revision broke threshold.

### 2. Sector page

- **P0** Driver leaderboard: ranked KPIs with standardised effect size, 90% confidence interval, incremental R² (share of explained variance), lead/lag (does it lead price?), and a stability badge (stable / regime-dependent / unstable).
- **P0** Return decomposition chart: stacked bars per quarter of sector return into market, style factors and sector-specific.
- **P0** Earnings vs re-rating: for each stock, cumulative return split into EPS growth and multiple change over 1, 3 and 5 years.
- **P0** Peer table: each stock's own top-3 drivers, flagging where a stock departs from the sector pattern.
- **P1** Regime view: coefficients for each driver across pre-COVID, COVID, 2022 rate hikes, post-2023, with rolling 12-quarter lines.
- **P1** Valuation bands: P/E, P/B or EV/EBITDA vs 5 and 10-year history, with the drivers that historically explained re-ratings.

### 3. Stock page

- **P0** Header: price, 1D/1M/12M return, market cap, Bloomberg consensus target and upside, Buy/Hold/Sell counts, Buoyant-weighted consensus target, all with as-of dates.
- **P0** Attribution waterfall: last 1, 3 and 12 months' return bridged from market to sector to style to stock-specific, then stock-specific into earnings vs re-rating vs unexplained.
- **P0** Driver panel: the stock's top drivers with sensitivity ("1 pp of volume growth surprise ≈ +x% excess return over 20 days, CI …"), and the KPI's latest value vs consensus.
- **P0** KPI history: each driver's quarterly series overlaid on excess price return, results dates marked.
- **P0** Results timeline: each quarter's surprise on revenue, EBITDA, PAT and sector KPIs vs the abnormal return from day −1 to +3 and to +60.
- **P1** Commentary check: Narrative Map scores or transcript tone against the actual KPI direction, with mismatches highlighted.
- **P1** Notes tab: links to the latest transcript, broker notes and house notes in Airavat.

### 4. Attribution Explorer

- **P0** Pick universe (stock, sector, custom basket), horizon (event window, monthly, quarterly), dependent variable (total, excess, stock-specific, re-rating) and candidate drivers.
- **P0** Show results of the pre-run models: coefficient table, partial-dependence plots, SHAP summary for the tree model, out-of-sample R² vs in-sample.
- **P1** Hypothesis mode: analyst adds a new candidate KPI; the app queues a run and records it in the experiment registry so the multiple-testing count stays honest.

### 5. Event Studies

- **P0** Cumulative abnormal return curves (−5 to +60 trading days) bucketed by surprise size (quintiles) for a chosen metric and universe.
- **P0** Post-results drift test: does the reaction continue after day +3? With t-stats and bootstrap confidence bands.
- **P1** Same for guidance changes, rating changes, large consensus revisions and block deals.

### 6. Broker Scorecard

- **P0** League table by sector: forecast error (FY1 and FY2 EPS, EBITDA), bias, timeliness, rating-call excess return, shrunk accuracy score and its weight in the Buoyant consensus.
- **P0** Company drill-down: each broker's estimate path vs actuals and vs Bloomberg mean over time.
- **P0** Weighted vs plain consensus: current values side by side, with the historical backtest showing which forecast better.
- **P1** Dispersion monitor: stocks where broker spread is unusually wide or narrowing fast.

### 7. Forward Paths

- **P0** Fan chart of simulated 3, 6 and 12-month return distributions with 10th/25th/50th/75th/90th percentiles.
- **P0** Bull/base/bear table: KPI and earnings assumptions per case, implied multiple, implied price, probability weight.
- **P0** Sensitivity tornado: which inputs move the median most.
- **P1** Scenario editor: a PM overrides a KPI path ("volumes +6% not +9%") and sees the distribution redraw instantly from cached sensitivities.
- **P1** Model history: past forecasts for this stock vs what happened.

### 8. Backtest Lab

- **P0** For each model version: rank IC and IC t-stat by month, hit rate, decile spread within sector, deflated Sharpe of a long-short test portfolio, turnover, by regime.
- **P0** Experiment registry: every hypothesis tested, with date, analyst, result and the false discovery rate adjustment applied.
- **P1** Compare two model versions on the same walk-forward folds.

### 9. Data Health

- **P0** Coverage matrix: stock × dataset with last update, period range and gaps.
- **P0** Validation failures: quarters that don't sum to the year, EPS × shares ≠ PAT, unadjusted corporate actions, unreadable broker PDFs.
- **P0** Pipeline run log with status and duration.

### 10. Research Studio (Part B bridge)

- **P1** Analysts pin charts and tables from any screen into a draft pack (sector note, monthly market pack, stock note).
- **P1** Compliance status per pack: draft, in review, approved for internal, approved for external.
- **P1** External packs strip Bloomberg-licensed numbers and broker names automatically, replacing them with Buoyant-derived aggregates.
- **P2** One-click export to Buoyant's slide and document templates.

### Cross-cutting

- **P0** Global search by company name or NSE code; ⌘K command palette.
- **P0** Every number hover-shows source tag, e.g. `[AIRAVAT:get_financials FY27Q2]`, `[BBG consensus 2026-10-26]`.
- **P0** Shareable deep links that keep filters (sector, horizon, model version, as-of date).
- **P1** "As-of" time machine: view any page as it would have looked on a past date, using only data known then.

## Data requirements

Every stored value carries two dates: the period it describes and the date the market could first know it (`known_at`). No model or screen may read a value with `known_at` after its as-of date. This rule is enforced in the data layer, not left to each model.

### Sources

| Dataset | Source | Grain | History needed | Refresh | Known gap |
| --- | --- | --- | --- | --- | --- |
| Prices, volumes, corporate actions | Airavat `get_price_history` | Daily | FY15 onward | Daily after close | Confirm split, bonus, demerger adjustment |
| Benchmark and sector indices | Airavat or NSE index files | Daily | FY15 onward | Daily | Confirm Airavat holds index series |
| Financials (P&L, BS, CF, quarterly) | Airavat `get_financials` | Quarterly, annual | FY15 annual, FY20 quarterly | Results week | Results announcement timestamp per quarter |
| Operating KPIs | `get_investor_presentation`, transcripts, sector skill KPI lists | Quarterly | FY20 onward | Results week | Deck release dates; KPI naming varies by deck |
| Bloomberg consensus | `get_consensus_estimates` | Snapshot | As long as possible | Daily | 100 snapshots only; revision rows lack FY labels |
| Broker estimates, targets, ratings | Report library + Research Mailbox, extracted | Per note | 3+ years | Daily | Largest build; scanned PDFs need OCR |
| Narrative scores | Airavat Narrative Map | Quarterly | FY23 onward | Results week | No API; scrape via logged-in browser or ask Labs |
| Fund flows | Tijori `get_fund_flow` | Daily, monthly | FY18 onward | Daily | Release-date stamping |
| Macro indicators | Tijori `get_macro_indicators`, India Data Hub | Monthly | FY15 onward | On release | Revisions: keep first-release vintage |
| Shareholding | Tijori `get_shareholding` | Quarterly | FY18 onward | Quarterly | Filing date per quarter |
| Commodities | Airavat `get_commodity_prices` | Daily | FY15 onward | Daily | None known |
| Portfolio holdings and weights | Buoyant internal | Daily | 2 years | Daily | Upload format to agree |

### Core data model

The warehouse is a set of tidy, long tables. Simplified schema:

- `security(security_id, nse_code, bse_code, name, sector, sub_sector, listing_date, delisting_date)`
- `price_daily(security_id, date, open, high, low, close, adj_close, volume, adj_factor)`
- `index_daily(index_id, date, close)`
- `fundamental(security_id, basis, data_class, period, field, value_crore, unit_raw, known_at, source_tag)`
- `kpi(security_id, period, kpi_code, value, unit, known_at, source_tag, extraction_confidence)`
- `consensus_snapshot(security_id, snapshot_date, fiscal_year, metric, mean, median, high, low, n_estimates, source)`
- `broker_estimate(note_id, security_id, broker, analyst, note_date, fiscal_year, metric, value, target_price, rating, source_doc_id)`
- `macro(series_id, period, value, release_date, vintage)`
- `flow(series_id, date, value, known_at)`
- `event(security_id, event_type, event_ts, payload_json)` for results, guidance, rating changes, block deals
- `model_run(run_id, model_code, version, universe, train_end, params_json, code_hash, created_at)`
- `model_output(run_id, security_id, as_of, output_type, payload_json)`
- `experiment(exp_id, hypothesis, analyst, created_at, n_tests, raw_p, adjusted_p, verdict)`

### Data quality rules (enforced on load)

1. Four quarters must sum to the fiscal year within 0.5% for revenue, EBITDA and PAT; breaks are flagged, not dropped.
2. EPS × weighted shares must match PAT within 1%.
3. Adjusted prices must show no unexplained one-day jumps greater than 35% without a corporate-action record.
4. Each broker estimate must link to a source document; extraction confidence below 0.8 goes to a review queue.
5. Consensus revision rows are matched to FY1/FY2/FY3 by continuity; ambiguous matches are flagged and excluded from models until resolved.
6. Macro series store first-release values; later revisions are new vintages, never overwrites.
7. Survivorship: delisted and merged companies stay in the universe for the periods they traded.

### Broker estimate extraction (the largest build)

- Pull every broker note per covered company from the report library and Research Mailbox.
- Extract with an LLM pass plus table parsers: broker, note date, rating, target price, FY1/FY2/FY3 revenue, EBITDA, PAT, EPS.
- Validate against the note's own text (cross-check the target against the stated upside and price), and against Bloomberg consensus range on that date.
- Human review queue in Data Health for low-confidence rows; target 95% precision on target price and FY1 EPS on a 200-note audit sample before Phase 2 goes live.
- View-only portal notes (for example Avendus, Ambit): extract numbers from the email text only; never store the PDF.

## Analytics and statistical methodology

Models are tested on data they never saw, in time order, with the number of hypotheses tried counted and corrected for. A driver is shown as "validated" only if it passes every gate in the acceptance table below.

### Phase 1: Attribution

**1a. Factor model.** Daily and monthly returns regressed on market (Nifty 500), sector index and style factors built from the covered universe: size, value (B/P, E/P), momentum (12-1 month), quality (ROE, accruals), low volatility. Rolling 36-month betas, with Ledoit-Wolf shrinkage on the factor covariance. Output: each stock's stock-specific return series.

```latex
r_{i,t} - r_{f,t} = \alpha_i + \beta_i^{M} f^{M}_t + \beta_i^{S} f^{S}_t + \sum_k \gamma_{i,k} f^{k}_t + \varepsilon_{i,t}
```

**1b. Earnings vs re-rating split.** Log return over a period is split into change in forward EPS (consensus FY1/FY2 blended to a 12-month-forward value) and change in forward P/E; dividends kept separate. For banks and NBFCs, use book value and P/B.

```latex
\ln\frac{P_{t}}{P_{t-h}} = \ln\frac{E^{fwd}_{t}}{E^{fwd}_{t-h}} + \ln\frac{(P/E)^{fwd}_{t}}{(P/E)^{fwd}_{t-h}}
```

**1c. Event studies.** Abnormal return = stock-specific return from 1a. Windows: day −1 to +3 (reaction) and +4 to +60 (drift). Surprise = (actual − consensus mean at day −1) ÷ cross-sectional dispersion or historical surprise volatility. Test with Patell and BMP standardised tests plus cluster-robust bootstrap by date, because results cluster in the same weeks.

**1d. Panel regressions.** Sector-level panel of stock × quarter: dependent variables are stock-specific return, earnings component and re-rating component. Drivers enter as surprises and changes, not levels, to keep series stationary. Stock and quarter fixed effects; standard errors clustered by stock and by quarter (two-way). Fama-MacBeth cross-sectional regressions as a robustness check.

**1e. Driver discovery.** Three layers, in this order:

1. Prior set: the KPIs each Buoyant sector skill lists as key (for example cement: volume, realisation/t, cost/t, EBITDA/t, utilisation). These are tested first, as pre-registered hypotheses.
2. Elastic net with time-series cross-validation over a wider candidate set (lags 0 to 2 quarters, macro, flows, revisions, dispersion, narrative scores).
3. Gradient-boosted trees (LightGBM) with SHAP values for nonlinear effects and interactions; kept only if out-of-sample R² beats the linear model by a meaningful margin.

**1f. Lead or coincident.** Granger-style tests and local projections (Jordà) on KPI surprises vs subsequent excess returns, to separate drivers that predict from drivers that only co-move.

### Phase 2: Broker accuracy

- Forecast error per note: absolute percentage error of FY1/FY2 EPS and EBITDA vs actual, measured against the error of Bloomberg mean on the same date (relative accuracy), so harder years don't penalise everyone.
- Horizon adjustment: errors modelled as a function of days to fiscal year end; scores use the residual.
- Bias: mean signed error. Timeliness: lead of a broker's revision vs consensus moving the same way.
- Rating calls: 3, 6 and 12-month excess return after upgrades, downgrades and initiations.
- Hierarchical Bayesian model: broker skill at company level is pooled toward the broker's sector skill, which is pooled toward the all-broker mean. Brokers with few notes get scores near average.
- Weighted consensus: weights proportional to the inverse of posterior expected squared error, capped at 25% for any one broker, with stale estimates (older than 90 days or before last results) down-weighted.
- Promotion rule: the weighted consensus replaces the plain mean in Phase 3 only if it has lower out-of-sample error in a Diebold-Mariano test at 5% on the pilot sector.

### Phase 3: Forward paths

1. For each stock, draw KPI and earnings paths from a distribution centred on the weighted consensus, with spread set by (a) broker dispersion and (b) the historical distribution of consensus errors at the same horizon.
2. Map KPI paths to expected excess return using Phase 1 sensitivities, including their parameter uncertainty (draw coefficients from their posterior or bootstrap distribution).
3. Add re-rating: forward multiple modelled as mean-reverting toward a driver-implied fair multiple, with reversion speed estimated from history.
4. Add market and sector return draws from a block bootstrap of history, so fat tails and crash periods appear in the ranges.
5. Monte Carlo: 10,000 paths per stock; report percentiles, probability of beating Nifty, and the contribution of each input to variance.
6. Calibration: check that realised returns fall inside the 80% band about 80% of the time (probability integral transform test); if not, widen or narrow bands.

### Validation protocol

- **Walk-forward** with expanding training windows, re-fitted every quarter.
- **Purged and embargoed cross-validation** (López de Prado): training samples whose return windows overlap the test window are removed, plus a 20-trading-day embargo after each test fold.
- **Combinatorial purged CV** for model selection, giving a distribution of out-of-sample scores rather than one number.
- **Multiple testing:** every hypothesis logged in the experiment registry. Benjamini-Hochberg false discovery rate control at 10% for driver lists; Hansen's SPA test for model comparisons; deflated Sharpe ratio and probability of backtest overfitting for any portfolio test.
- **Regime stability:** coefficients re-estimated per regime and on rolling 12-quarter windows; a Chow or sup-F structural-break test flags breaks.
- **Placebo tests:** shuffle KPI dates within stock and re-run; the real effect must exceed the 95th percentile of placebo effects.

### Acceptance gates for a "validated" driver

| Gate | Threshold |
| --- | --- |
| Sign matches economic prior (or new driver justified in writing) | Required |
| BH-adjusted significance | q below 0.10 |
| Out-of-sample incremental R² | Above 0 in at least 70% of walk-forward folds |
| Regime stability | Same sign in at least 3 of 4 regimes |
| Placebo | Effect above 95th percentile of shuffled effects |
| Sample | At least 8 stocks and 60 stock-quarters in the panel |

Drivers that fail are still shown, labelled "unvalidated" or "unstable", so users see what was tested.

### Stack

Python 3.12 with pandas/polars, statsmodels, linearmodels (panel), scikit-learn, LightGBM, SHAP, PyMC (hierarchical broker model), arch (bootstrap), and mlfinlab-style purged CV implemented in-house. Every run records code hash, data snapshot id and parameters, so any number on screen can be reproduced.

## System architecture and deployment

The frontend is a Next.js app on Vercel; all statistics run on a separate Python worker, because model runs take minutes to hours and exceed Vercel function limits. The worker writes results to Postgres, and the app reads only precomputed JSON, so pages load in under 2 seconds.

&#91;embedded content: system architecture · worker, storage, Vercel\]

Model runs read raw data from the Parquet lake and write outputs back to it and to Postgres; Vercel never calls Airavat directly.

### Components

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui | Fast server-rendered pages, standard Vercel target |
| Charts | Apache ECharts for dense finance charts; Visx for custom waterfalls and fan charts | Handles 10,000-point series and custom shapes |
| Tables | TanStack Table with virtualised rows | Sortable sector tables with hundreds of rows |
| State and data fetching | React Server Components + TanStack Query for client interactions | Cached, shareable URLs hold filter state |
| API | Next.js route handlers, read-only, typed with Zod | Thin layer over Postgres; no compute |
| Serving database | Postgres (Neon or Supabase, Mumbai region) | Vercel-native connection pooling; Neon branches per preview deploy |
| Lake | Parquet on Cloudflare R2 or AWS S3 (ap-south-1), queried with DuckDB in the worker | Cheap, versioned snapshots; fast analytics |
| Worker | Python 3.12 jobs on Modal, or a Buoyant VM with cron (decide with IT) | Long-running stats, scheduled runs, GPU not needed |
| Orchestration | Prefect or Dagster flows: ingest → validate → model → publish | Retries, run log feeding Data Health |
| Scenario editor | Cached sensitivities and simulation seeds in Postgres; redraw runs in the browser in a Web Worker | Sub-second scenario changes without server compute |
| Auth | Auth.js with Google Workspace or Microsoft Entra SSO, domain-restricted; roles in Postgres | Buoyant-only access, shareable links for signed-in users |
| Monitoring | Vercel Analytics, Speed Insights, Sentry; worker alerts to Slack or email | Catch slow pages and failed runs |

### Deployment on Vercel

1. Monorepo on GitHub: `apps/web` (Next.js), `packages/schema` (shared types generated from the database), `worker/` (Python).
2. Vercel project linked to `apps/web`: every pull request gets a preview URL behind Deployment Protection; `main` deploys to production.
3. Production domain: `drivers.buoyant…` (or a Vercel subdomain until DNS is set), functions pinned to region `bom1` (Mumbai).
4. Secrets (database URL, auth keys) in Vercel environment variables, separate for preview and production.
5. The worker publishes a new results snapshot id when a run passes validation; the app reads the latest published id, so a failed run never shows half-updated data.
6. Rollback: Vercel instant rollback for the app; snapshot pointer rollback for data.

### Data refresh schedule (IST)

| Job | When | Output |
| --- | --- | --- |
| Prices, indices, flows, commodities | Daily 18:30 | Updated price and factor returns |
| Consensus snapshots | Daily 20:00 | New consensus rows, revision breadth |
| Broker note extraction | Every 2 hours, 08:00 to 22:00 | New broker estimates into review queue |
| Results ingestion | Within 6 hours of each filing | Financials, KPIs, surprises, event returns |
| Factor model and event studies | Nightly | Attribution outputs |
| Panel models, broker scores, forward paths | Weekly (Sunday) and after each results season | New model version, validated before publish |

## Non-functional requirements

The app must be fast, private to Buoyant, and fully reproducible; licensing limits what leaves it.

| Area | Requirement |
| --- | --- |
| Performance | Sector and stock pages under 2 s (p95) on office broadband; charts render under 500 ms from cached JSON; scenario editor redraws under 1 s |
| Availability | 99.5% in Indian market hours (09:00 to 18:00 IST); pipeline failures never take the app down, it serves the last good snapshot with a stale-data banner |
| Freshness | Prices by 19:00 IST daily; results-driven updates within 48 h of filing; consensus daily |
| Access control | Buoyant SSO only (Google Workspace or Microsoft Entra, to confirm); roles Admin, Editor, Viewer; Vercel Deployment Protection on preview URLs |
| Shareable links | Deep links work for any signed-in Buoyant user; no public links; optional time-limited view links for named external reviewers (P2) |
| Security | Secrets in Vercel and worker secret stores only; no credentials in code; Airavat and Tijori accessed via service keys; least-privilege database roles; audit log of sign-ins and exports |
| Data residency | Prefer India region (Vercel bom1 for functions; database and storage in ap-south-1 / Mumbai) |
| Reproducibility | Every displayed number links to model run id, code hash and data snapshot; any run can be re-executed byte for byte |
| Auditability | Experiment registry is append-only; model versions are never edited in place |
| Licensing | Bloomberg consensus and broker-level data shown internally only, subject to Buoyant's Bloomberg licence terms; external exports strip them automatically; broker report text never redistributed |
| Compliance | Research Studio packs need compliance approval before external use; SEBI disclaimers and, if applicable, PMS/AIF performance-advertising rules applied in templates |
| Accessibility | Keyboard navigation, colour-blind-safe palettes, every chart has a data table view |
| Devices | Desktop first (1440 px), usable on tablet; phone shows Home, Stock header and alerts only |
| Observability | Vercel Analytics and Speed Insights; pipeline metrics and alerts to Slack or email on failure |

## Delivery plan

One pilot sector goes end to end in about 16 weeks, then a go/no-go review decides the rollout to Buoyant's top-allocated sectors by week 24. Week counts are estimates and depend most on Airavat API access and the broker extraction audit.

&#91;embedded content: delivery timeline · 6 milestones, pilot gate at week 16\]

Phases overlap: the app shell and screens are built against pilot data while the models are still being validated.

### Milestones and acceptance criteria

| Milestone | Deliverables | Accepted when |
| --- | --- | --- |
| M0 Setup and access | Repo, Vercel project with SSO, database, worker, Airavat and Tijori service access | A signed-in Buoyant user opens the deployed shell at a shareable URL; worker pulls one company's data unattended |
| M1 Pilot data | Point-in-time warehouse for the pilot sector: prices, financials, KPIs, consensus, flows, macro; first broker extraction pass | Data Health shows 95%+ coverage FY20 to latest; all quality rules pass or are flagged; 200-note extraction audit at 95% precision on target and FY1 EPS |
| M2 Attribution + screens | Factor model, earnings vs re-rating, event studies, panel models; Home, Sector, Stock, Attribution, Event Studies, Data Health screens | Driver leaderboard for the pilot sector with validated and unvalidated labels; 2 PMs confirm it answers their top 5 questions |
| M3 Broker scorecard | Accuracy scores, hierarchical model, weighted consensus, Broker Scorecard screen | Diebold-Mariano test vs plain consensus reported; weighted consensus promoted only if it wins |
| M4 Forward paths | Monte Carlo engine, Forward Paths and Backtest Lab screens, scenario editor | Walk-forward rank IC, calibration and regime results published; Jigar's go/no-go decision |
| M5 Rollout + Studio | Remaining top sectors, alerts, holdings overlay, Research Studio with compliance workflow | Each new sector passes M1 to M4 criteria; first internal sector pack and one approved client pack exported |

## Risks, open questions and dependencies

The biggest risks are data access for an automated pipeline and too little history for robust statistics; both are tested in the first two weeks of the pilot.

### Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| No machine API for Airavat outside Claude's connector | Pipeline cannot refresh unattended | High | Ask Labs for service API keys; interim: scheduled Claude runs write snapshots to storage |
| Short history (about 25 quarters per stock) | Weak, unstable estimates | High | Pool at sector level, shrinkage, report confidence intervals; monthly and event-level data where possible |
| Consensus revision history limited to 100 snapshots, no FY labels | Phase 2 and revision drivers impaired | High | Labs fix; meanwhile rebuild consensus from extracted broker notes |
| Broker extraction errors | Wrong accuracy scores | Medium | Validation rules, review queue, 200-note audit before launch |
| Overfitting, data mining | False drivers presented as real | Medium | Pre-registered priors, purged CV, BH correction, placebo tests, experiment registry |
| Look-ahead bias | Backtests look better than reality | Medium | `known_at` enforced in data layer; time-machine tests |
| Bloomberg licence terms | Display restricted, even internally | Medium | Confirm with Bloomberg account manager before pilot launch |
| Regime change | Historical drivers stop working | Medium | Regime badges, rolling coefficients, alerts on breaks |
| Low adoption | App unused | Medium | Pilot with 2 PMs; build screens around their actual questions |

### Open questions for Jigar

- [ ] Forecast horizon priority: 1, 3 or 12 months?
- [ ] Primary output for PM decisions: return ranges, rankings within sector, or both?
- [ ] Pilot sector (proposal: cement or private banks for clean KPIs and deep broker coverage).
- [ ] Top-allocated sectors and current holdings, for the rollout order and Home overlay.
- [ ] Who has Admin access; should sales see the app or only exported packs?

### Dependencies on Buoyant Labs

- [ ] Service API access to Airavat (financials, deck KPIs, consensus, library, prices) for an unattended pipeline.
- [ ] Full consensus revision history with fiscal-year labels.
- [ ] Results announcement timestamps per company and quarter.
- [ ] Broker-level Bloomberg estimates, if the feed can carry them (would replace most of the extraction build).
- [ ] Fix for house notes and synthesis reports returning HTTP 500.
- [ ] Narrative Map scores via API.

### Dependencies on Buoyant IT and compliance

- [ ] Vercel team account (Pro plan for Deployment Protection and SSO) and a GitHub repository.
- [ ] Cloud account for database, object storage and compute worker (India region).
- [ ] SSO provider details (Google Workspace or Microsoft Entra).
- [ ] Tijori service credentials.
- [ ] Bloomberg licence confirmation for internal web display.
- [ ] Compliance owner for Research Studio approvals.

## Appendix: glossary and example outputs

| Term | Definition |
| --- | --- |
| Stock-specific return | Return left after removing market, sector and style-factor effects (residual of the factor model) |
| Surprise | (Actual − consensus mean the day before results) ÷ historical surprise volatility for that stock and metric |
| Abnormal return (CAR) | Cumulative stock-specific return over an event window |
| Incremental R² | Extra share of return variance explained when a driver is added to the model |
| Rank IC | Spearman correlation between predicted and realised returns across stocks at each date |
| Deflated Sharpe ratio | Sharpe ratio adjusted for the number of strategies tried and non-normal returns |
| Purged CV | Cross-validation that removes training samples overlapping the test period, plus an embargo gap |
| BH correction | Benjamini-Hochberg procedure controlling the share of false discoveries among drivers called significant |
| Shrinkage | Pulling noisy estimates (for example a broker's accuracy on one stock) toward a group average in proportion to how little data there is |
| Weighted consensus | Broker estimates weighted by their shrunk historical accuracy, capped at 25% per broker |
| Point-in-time | Each value used only from the date it was first public (`known_at`) |
| Regime | A period with distinct market conditions: pre-COVID (to Feb 2020), COVID (Mar 2020 to Dec 2021), rate hikes (2022), post-2023 |

### Example output: stock driver panel (illustrative format, not real results)

| Driver | Sensitivity | 90% CI | Incremental R² | Leads price? | Stability |
| --- | --- | --- | --- | --- | --- |
| Volume growth surprise (1 pp) | +x% excess return, 20 days | \[a, b\] | y% | Yes, 1 quarter | Stable |
| EBITDA/t surprise (₹100) | +x% | \[a, b\] | y% | Coincident | Regime-dependent |
| FY2 EPS revision (1%) | +x% | \[a, b\] | y% | Yes, 1 month | Stable |

### Example output: forward path summary (illustrative format)

> 12-month excess return vs Nifty: median +x%, 80% range −a% to +b%. Probability of beating Nifty: p%. Biggest swing factors: volume growth (±c pp of median), FY2 consensus revision (±d pp). Weighted consensus FY2 EPS ₹e vs Bloomberg mean ₹f.
