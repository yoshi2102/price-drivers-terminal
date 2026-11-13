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

## What the pilot data says (prices to 12 Nov 2026, extended data)

The data was extended from Airavat: results dates for 11 of 12 stocks (241 dated quarters), quarterly history back to FY16 for UltraTech, ACC, Ambuja, Star and JK Lakshmi, street expectations from broker previews for FY25Q3 and FY26Q2–FY27Q2, and 66 older UltraTech broker notes. The panel grew from 312 to 382 stock-quarters.

- **EBITDA margin change passes five of six gates.** Effect +4.1% per 1 SD on the post-results window, BH q = 0.046, same sign in 3 of 4 regimes, beats 97% of placebos, 12 stocks. It fails out of sample: it beats the baseline in 46% of walk-forward quarters, against 70% required. Labelled unvalidated.
- **Revenue against street expectations shows post-results drift.** Top minus bottom quintile +6.2% over days +4 to +60, 90% interval +1.4% to +10.7%, but on only 44 events.
- **Broker accuracy is now scored for UltraTech** (90 estimates). The weighted consensus beat the plain average in 9 of 11 months, but the Diebold-Mariano test gives p = 0.84, so it is not promoted.
- **Discovery models still fail out of sample** and the backtest rank IC stays near zero (0.003), well short of 0.05.

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
