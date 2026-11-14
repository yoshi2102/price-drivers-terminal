# Price Drivers Terminal

Buoyant's internal app for one question: what moves each covered stock, and how sure are we? It follows `PRD_Buoyant_Price_Drivers_Terminal.md` (13 Nov 2026). Cement is the pilot sector, end to end, on real Airavat data.

```
worker/           Python 3.12+ pipeline: ingest -> validate -> model -> publish
  pdt/ingest.py     point-in-time warehouse (every fundamental carries known_at)
  pdt/quality.py    PRD data-quality rules 1-7, flagged not dropped
  pdt/factors.py    1a factor model: market, sector (leave-one-out), momentum, low-vol
  pdt/attribution.py 1b-1f: earnings vs re-rating, event studies, panel regressions,
                    six acceptance gates, elastic net + LightGBM/SHAP
  pdt/brokers.py    Phase 2: accuracy, empirical-Bayes shrinkage, weighted consensus, DM test
  pdt/forward.py    Phase 3: 10,000-path Monte Carlo, tornado, bull/base/bear, PIT calibration
  pdt/backtest.py   Backtest Lab: rank IC, NW t, hit rate, deflated Sharpe, by regime
  pdt/run.py        orchestrator; writes data/snapshots/<id>/ and moves the PUBLISHED pointer
apps/web/         Next.js 15 (App Router), Tailwind, ECharts (SVG renderer), Auth.js
packages/schema/  shared snapshot types
db/schema.sql     Postgres serving schema (PRD data model, append-only experiment table)
```

## Run it

```bash
pip install -r worker/requirements.txt
```

```bash
cd worker && PDT_RAW_DIR=/path/to/pdt-raw python -m pdt.run
```

```bash
cd apps/web && npm install && npm run dev
```

The committed snapshot means the last command alone is enough to browse the app at http://localhost:3000.

The worker takes about 30 seconds and copies the snapshot into `apps/web/data/`. Without `AUTH_SECRET` the app runs open on localhost; with it, every page needs a signed-in user on `AUTH_ALLOWED_DOMAIN`.

`npm run export:static` builds an auth-free static copy in `apps/web/out/` for offline review.

## Deploy on Vercel

1. Vercel project root: `apps/web`. Region `bom1` is set in `vercel.json`.
2. Environment variables, separate for preview and production: `AUTH_SECRET`, `AUTH_ALLOWED_DOMAIN`, and either the Google (`AUTH_GOOGLE_*`) or Microsoft Entra (`AUTH_MICROSOFT_ENTRA_ID_*`) set. See `.env.example`.
3. `PDT_SNAPSHOT_URL`: bucket prefix where the worker uploads `PUBLISHED` and `<id>/`. `prebuild` pulls the published snapshot, so a failed worker run never reaches the site. Rollback is a pointer change plus Vercel instant rollback.
4. Turn on Deployment Protection for previews.

The pilot snapshot (`apps/web/data/`) is committed so the app runs straight after cloning. It carries Bloomberg consensus and broker-level estimates, which the PRD restricts to internal display: keep this repo private, and move the snapshot to object storage before widening access.

## What the data says (prices to 13 Nov 2026)

Two sectors are live: cement (pilot, 12 stocks) and IT services (12 stocks; LTIMindtree and Coforge left out because their Airavat price history is incomplete).

**Cement** (382 stock-quarters, FY16–FY27; results dates for 11 stocks)
- EBITDA margin change is the strongest driver: +4.0% per 1 SD on the post-results window, BH q = 0.02, same sign in 3 of 4 regimes. It passes 4 of 6 gates, failing out of sample (50% of walk-forward folds, 70% needed) and narrowly the placebo test (93rd percentile of 1,000 shuffles, 95th needed).
- No reliable post-results drift. Backtest rank IC 0.03.

**IT services** (340 stock-quarters; results dates for all 12; IT KPIs mostly FY21 onward; street previews from FY24Q3)
- EBITDA margin change passes 5 of 6 gates (q = 0.05, 3 of 3 regimes, 99th percentile placebo) and fails only out of sample (64%).
- Revenue against broker previews: +5.4% per 1 SD, q < 0.001, but only ten quarters of history, so it cannot pass the regime or out-of-sample gates yet.
- Post-results drift exists: biggest EBITDA and PAT beats outperform the biggest misses by 4.8% and 5.8% over days +4 to +60 (intervals exclude zero).
- The P/E-reversion signal is significantly wrong-signed for IT (rank IC −0.16, t −2.8; −0.19 with drivers added). Logged, not acted on.
- Sector moves explain 27% of daily variance in IT against 14% in cement.

**Broker scorecards** (UltraTech, Infosys): track-record weighting beat the plain average in 9 of 11 months for both, but neither passes the Diebold-Mariano test (p = 0.84 and 0.36), so neither is promoted.

## Remaining data gaps (not in Airavat)

| Gap | Owner |
| --- | --- |
| Board-meeting dates for Shree, and exact dates where only call dates exist | Labs: exchange announcement feed |
| Bloomberg quarterly consensus before 2025 | Labs |
| FY16–FY20 quarterly results for Shree, Dalmia, JK Cement, Ramco, Birla, Heidelberg | Labs or ACE history |
| Broker notes for the other 11 stocks | Extraction job with 200-note audit |
| NSE index files | IT |

## Design

The style is a quiet data terminal. Warm paper ground, white surfaces and one cobalt accent. Colour carries meaning only: the four attribution layers always use the same colours, and direction always carries a sign or arrow. Type is Newsreader for page titles, Schibsted Grotesk for UI and JetBrains Mono for every figure (tabular). Light and dark themes are both tested. Every chart has a table view, PNG/SVG/CSV export, sample size, as-of date and source tag. Every number with a source shows it on hover.
