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

The worker takes about 30 seconds and copies the snapshot into `apps/web/data/`. Without `AUTH_SECRET` the app runs open on localhost; with it, every page needs a signed-in user on `AUTH_ALLOWED_DOMAIN`.

`npm run export:static` builds an auth-free static copy in `apps/web/out/` for offline review.

## Deploy on Vercel

1. Vercel project root: `apps/web`. Region `bom1` is set in `vercel.json`.
2. Environment variables, separate for preview and production: `AUTH_SECRET`, `AUTH_ALLOWED_DOMAIN`, and either the Google (`AUTH_GOOGLE_*`) or Microsoft Entra (`AUTH_MICROSOFT_ENTRA_ID_*`) set. See `.env.example`.
3. `PDT_SNAPSHOT_URL`: bucket prefix where the worker uploads `PUBLISHED` and `<id>/`. `prebuild` pulls the published snapshot, so a failed worker run never reaches the site. Rollback is a pointer change plus Vercel instant rollback.
4. Turn on Deployment Protection for previews.

Snapshot JSON is kept out of git on purpose. It carries Bloomberg consensus and broker-level estimates, which the PRD restricts to internal display.

## What the pilot data says (prices to 12 Nov 2026)

- **No driver passes all six gates.** Fifteen candidates were tested on 312 stock-quarters. The best, EBITDA margin change, has p = 0.031 and q = 0.47 after Benjamini-Hochberg. Every driver is shown, labelled unvalidated or unstable.
- **Stock-specific news explains 60% of daily variance** in cement over three years. Market explains 19%, style 14% and sector 8%. The tested KPI set explains little of the rest.
- **Discovery models fail out of sample.** Elastic net shrinks every coefficient to zero (OOS R² −0.6%). LightGBM fits in-sample, scores −11% out of sample, and is rejected.
- **Event studies (79 events with announced dates):** no reliable drift after day +3 for any surprise metric. The EBITDA-surprise top-minus-bottom drift is −3.5%, with a 90% interval of −7.4% to +0.3%.
- **Forward paths:** 12-month 80% bands held only 68% of outcomes in the walk-forward PIT test, so 12-month bands are widened ×1.28. 3-month bands held 79% and are left as they are.
- **Backtest:** rank IC is +0.009 (fp-1.0) and −0.008 (control) over 43 months. Both are well short of the PRD target of 0.05.

These are honest pilot numbers, not a failed build. The engine, gates and screens work. What limits the answers is data depth, listed below.

## Data gaps that limit the pilot (in priority order)

| Gap | Effect | Fix |
| --- | --- | --- |
| Quarterly financials start FY21 (ACE) and FY23 (UltraTech, Financials API) | No pre-COVID regime; about 20 quarters per stock | Labs: deeper quarterly history |
| Results dates exist for 6 of 12 stocks (96 quarters); Shree's are call dates 4–6 days late and are excluded | Event studies run on half the sector | Labs: results timestamps per company and quarter |
| Sales volumes for 7 stocks, mostly from Motilal Oswal tables | Tonne-based KPIs run on 92 obs; JK Lakshmi, Birla, Heidelberg, Star and Nuvoco are missing | Deck KPI extraction for the remaining five |
| Consensus history is 12 months, so there is no day-before consensus by quarter | Surprise is measured against each stock's own trend (SUE), not the street | Labs: full revision history with FY labels |
| 49 of 50 UltraTech broker notes are from April 2026 or later and forecast FY27–29 | Broker accuracy cannot be scored; the weighted consensus is not promoted | Extract 2023–25 notes from the report library and Research Mailbox |
| No index series in Airavat | Market factor is an equal-weighted basket of 16 large caps | NSE index files |
| Tijori not connected | No flows or macro on Home | Tijori service credentials |

## Design

The style is a quiet data terminal. Warm paper ground, white surfaces and one cobalt accent. Colour carries meaning only: the four attribution layers always use the same colours, and direction always carries a sign or arrow. Type is Newsreader for page titles, Schibsted Grotesk for UI and JetBrains Mono for every figure (tabular). Light and dark themes are both tested. Every chart has a table view, PNG/SVG/CSV export, sample size, as-of date and source tag. Every number with a source shows it on hover.
