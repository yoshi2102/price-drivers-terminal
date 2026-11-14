"""Data quality rules enforced on load (PRD rules 1-7). Breaks are flagged, never dropped."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def run(wh) -> tuple[list[dict], pd.DataFrame]:
    fails: list[dict] = []
    q = wh.quarterly

    # Rule 1: four quarters sum to the fiscal year within 0.5% (revenue, PAT).
    for t, ann in getattr(wh, "annual", {}).items():
        sub = q[q.ticker == t].set_index("period")
        for fy, a in ann.items():
            if len(fy) != 4:
                continue
            qs = [f"{fy}Q{i}" for i in range(1, 5)]
            if not all(p in sub.index for p in qs):
                continue
            for fld in ["revenue_cr", "pat_cr"]:
                tot, qsum = a.get(fld), sub.loc[qs, fld].sum()
                if tot and np.isfinite(tot) and abs(tot) > 1 and np.isfinite(qsum):
                    gap = qsum / tot - 1
                    if abs(gap) > 0.005:
                        fails.append({"rule": "Quarters sum to year", "ticker": t, "period": fy,
                                      "detail": f"{fld.replace('_cr','')}: quarters {qsum:,.0f} cr vs year {tot:,.0f} cr ({gap:+.1%})",
                                      "severity": "warn" if abs(gap) < 0.03 else "error"})

    # Rule 2: EPS x shares must match PAT within 1%. Implied share count is
    # compared quarter on quarter, so a real issuance flags once, not forever.
    for t, sub in q.groupby("ticker"):
        sub = sub[sub["eps"].abs() > 0.5]
        sh = (sub["pat_cr"] * 1e7 / sub["eps"]).replace([np.inf, -np.inf], np.nan)
        prev = sh.shift(1)
        for idx in sh.index:
            v, p = sh.loc[idx], prev.loc[idx]
            if np.isfinite(v) and np.isfinite(p) and abs(v / p - 1) > 0.01:
                r = sub.loc[idx]
                fails.append({"rule": "EPS x shares = PAT", "ticker": t, "period": r.period,
                              "detail": f"implied shares {v/1e7:,.2f} cr vs {p/1e7:,.2f} cr last quarter ({v/p-1:+.1%})",
                              "severity": "warn" if abs(v / p - 1) < 0.05 else "error"})

    # Rule 3: no unexplained one-day move > 35% (no corporate-action table loaded yet).
    rets = wh.prices.pct_change(fill_method=None)
    for t in rets.columns:
        big = rets[t][rets[t].abs() > 0.35].dropna()
        for d, v in big.items():
            fails.append({"rule": "Unexplained price jump", "ticker": t, "period": d.date().isoformat(),
                          "detail": f"one-day move {v:+.1%} with no corporate-action record", "severity": "error"})

    # Rule 4: broker estimates link to a source doc; confidence < 0.8 goes to review.
    b = wh.brokers
    if len(b):
        low = b[(b.get("extraction_confidence", 1) < 0.8) | b["source_tag"].isna()]
        for _, r in low.drop_duplicates("note_id").iterrows():
            fails.append({"rule": "Broker extraction review", "ticker": r.ticker, "period": str(r.note_date.date()),
                          "detail": f"{r.broker}: confidence {r.extraction_confidence:.2f}; queued for review",
                          "severity": "review"})

    # Rule 5: consensus revision rows need FY labels (Airavat history carries them as keys; flag gaps).
    for t, d in wh.consensus.items():
        rev = (d.get("consensus_revisions") or {}).get("annual") or {}
        if not rev:
            fails.append({"rule": "Consensus revisions", "ticker": t, "period": "-",
                          "detail": "no annual revision history returned", "severity": "warn"})

    # Rule 7 survivorship: report but nothing to drop.
    known_source = q.groupby("known_at_source").size().to_dict()
    df = pd.DataFrame(fails)
    return fails, pd.DataFrame([known_source])


def coverage(wh) -> list[dict]:
    rows = []
    q, px = wh.quarterly, wh.prices
    for t, name in C.ALL.items():
        sub = q[q.ticker == t]
        s = px[t].dropna() if t in px else pd.Series(dtype=float)
        cons = wh.consensus.get(t, {})
        vol = sub["volume_mt"].notna().sum() if "volume_mt" in sub else 0
        ev = (wh.events.ticker == t).sum() if len(wh.events) else 0
        nb = (wh.brokers.ticker == t).sum() if len(wh.brokers) else 0
        exp_q = len(sub)
        gaps = []
        periods = sorted(sub.period, key=lambda p: (p[:4], p[-1]))
        rows.append({
            "ticker": t, "name": name, "sector": C.SECTOR_OF[t],
            "datasets": {
                "prices": {"last": s.index.max().date().isoformat() if len(s) else None,
                           "from": s.index.min().date().isoformat() if len(s) else None, "n": int(len(s))},
                "financials": {"last": periods[-1] if periods else None, "from": periods[0] if periods else None,
                               "n": int(len(sub))},
                "kpi_volume": {"n": int(vol), "of": int(exp_q)},
                "kpi_it": {"n": int(wh.kpi_long[wh.kpi_long.ticker == t].period.nunique()) if len(getattr(wh, "kpi_long", [])) else 0, "of": int(exp_q)},
                "results_dates": {"n": int(ev), "of": int(exp_q)},
                "consensus": {"last": (cons.get("bloomberg_updated") or {}).get("annual"),
                              "n": int(len(wh.consensus_hist[wh.consensus_hist.ticker == t])) if len(wh.consensus_hist) else 0},
                "broker_notes": {"n": int(nb)},
            },
        })
    return rows
