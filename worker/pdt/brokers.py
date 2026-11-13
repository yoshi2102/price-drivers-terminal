"""Phase 2: broker accuracy, shrunk scores, Buoyant-weighted consensus, Diebold-Mariano promotion test."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from . import config as C


def _fy_end(fy: str) -> pd.Timestamp:
    return pd.Timestamp(f"20{fy[2:4]}-03-31")


def _actual_date(fy: str) -> pd.Timestamp:
    return _fy_end(fy) + pd.Timedelta(days=60)


def _latest(b: pd.DataFrame, asof: pd.Timestamp, fy: str, max_age: int = 180) -> pd.DataFrame:
    s = b[(b.fy == fy) & (b.note_date <= asof) & (b.note_date > asof - pd.Timedelta(days=max_age))]
    return s.sort_values("note_date").groupby("broker").tail(1)


def _weights(latest: pd.DataFrame, scores: dict, asof: pd.Timestamp, last_results: pd.Timestamp | None) -> pd.Series:
    base = np.array([np.exp(2 * scores.get(br, 0.0)) for br in latest.broker])
    w = 1 / base
    age = (asof - latest.note_date).dt.days.values
    stale = (age > 90) | ((latest.note_date < last_results).values if last_results is not None else False)
    w = w * np.where(stale, 0.5, 1.0)
    w = w / w.sum()
    for _ in range(10):  # cap 25%, redistribute
        over = w > 0.25
        if not over.any() or len(w) < 4:
            break
        excess = (w[over] - 0.25).sum()
        w[over] = 0.25
        w[~over] += excess * w[~over] / w[~over].sum()
    return pd.Series(w, index=latest.broker.values)


def _score(err: pd.DataFrame) -> dict:
    """Empirical-Bayes shrinkage of each broker's mean horizon-adjusted log error toward the all-broker mean."""
    if err.empty:
        return {}
    g = err.groupby("broker")["resid"]
    mu = err["resid"].mean()
    sig2 = err["resid"].var()
    means, ns = g.mean(), g.size()
    tau2 = max(means.var() - (sig2 / ns).mean(), 1e-4) if len(means) > 1 else 1e-4
    w = ns * tau2 / (ns * tau2 + sig2)
    return {br: float(mu + w[br] * (means[br] - mu) - mu) for br in means.index}


def run(wh, fac: pd.DataFrame) -> dict:
    b = wh.brokers
    if b.empty:
        return {"status": "no_data", "message": "No broker notes extracted yet."}
    b = b.dropna(subset=["eps"]).copy()
    b["fy"] = b["fy"].astype(str).str.upper()
    out = {"status": "ok", "tickers": {}}
    mkt = fac["market"].dropna().cumsum()
    for t, bt in b.groupby("ticker"):
        ann = getattr(wh, "annual", {}).get(t, {})
        actual = {fy: float(v["eps"]) for fy, v in ann.items() if v.get("eps") not in (None, "") and np.isfinite(float(v["eps"]))}
        rows = []
        for r in bt.itertuples():
            if r.fy not in actual or r.note_date >= _actual_date(r.fy):
                continue
            a = actual[r.fy]
            peers = _latest(bt[bt.broker != r.broker], r.note_date, r.fy, 60)
            peer_mean = peers.eps.mean() if len(peers) else np.nan
            ape = abs(r.eps - a) / abs(a)
            rows.append({"broker": r.broker, "fy": r.fy, "date": r.note_date, "est": r.eps, "actual": a,
                         "ape": ape, "signed": (r.eps - a) / abs(a),
                         "rel": ape - abs(peer_mean - a) / abs(a) if np.isfinite(peer_mean) else np.nan,
                         "days_to_fye": (_fy_end(r.fy) - r.note_date).days})
        err = pd.DataFrame(rows)
        scores, league = {}, []
        if len(err) >= 8:
            err["lape"] = np.log(err["ape"] + 0.01)
            X = np.column_stack([np.ones(len(err)), err["days_to_fye"] / 365])
            beta, *_ = np.linalg.lstsq(X, err["lape"].values, rcond=None)
            err["resid"] = err["lape"] - X @ beta
            scores = _score(err)
            # rating calls: excess return vs market proxy after each note
            px = np.log(wh.prices[t].dropna())
            calls = []
            for r in bt.drop_duplicates("note_id").itertuples():
                i = px.index.searchsorted(r.note_date)
                rec = {"broker": r.broker, "rating": str(r.rating)}
                for m, dd in [(3, 63), (6, 126), (12, 252)]:
                    if i + dd < len(px):
                        d0, d1 = px.index[i], px.index[i + dd]
                        rec[f"x{m}"] = float((px.iloc[i + dd] - px.iloc[i]) - (mkt.asof(d1) - mkt.asof(d0)))
                calls.append(rec)
            calls = pd.DataFrame(calls)
            def call_score(df):
                if df.empty or "x6" not in df:
                    return None
                sgn = df["rating"].str.lower().map(lambda s: 1 if any(k in s for k in ["buy", "add", "outperform", "accumulate", "overweight"])
                                                   else (-1 if any(k in s for k in ["sell", "reduce", "underperform", "underweight"]) else 0))
                v = (sgn * df["x6"]).dropna()
                v = v[sgn.loc[v.index] != 0]
                return float(v.mean()) if len(v) else None
            for br, e in err.groupby("broker"):
                league.append({"broker": br, "n_estimates": int(len(e)), "n_notes": int(bt[bt.broker == br].note_id.nunique()),
                               "mape": float(e["ape"].mean()), "bias": float(e["signed"].mean()),
                               "rel_accuracy": float(e["rel"].mean()) if e["rel"].notna().any() else None,
                               "score": scores.get(br, 0.0),
                               "call_excess_6m": call_score(calls[calls.broker == br]) if len(calls) else None})
        # walk-forward: weighted vs plain mean at month-ends, weights learnt from FYs already reported
        bt_rows = []
        for fy, a in actual.items():
            for d in pd.date_range(_fy_end(fy) - pd.DateOffset(months=15), _fy_end(fy), freq="ME"):
                lat = _latest(bt, d, fy)
                if len(lat) < 3:
                    continue
                past = err[(err.fy != fy) & (err.fy.map(_actual_date) <= d)] if len(err) else err
                sc = _score(past) if len(past) >= 8 else {}
                w = _weights(lat, sc, d, None)
                wc = float((lat.set_index("broker").eps * w).sum())
                pm = float(lat.eps.mean())
                bt_rows.append({"date": d.date().isoformat(), "fy": fy, "plain": pm, "weighted": wc, "actual": a,
                                "e_plain": (pm - a) / abs(a), "e_weighted": (wc - a) / abs(a), "learned": bool(sc)})
        btdf = pd.DataFrame(bt_rows)
        dm = None
        if len(btdf) and btdf.learned.sum() >= 6:
            s = btdf[btdf.learned]
            dlt = s.e_weighted ** 2 - s.e_plain ** 2
            n = len(dlt)
            e = dlt - dlt.mean()
            v = (e @ e) / n + 2 * sum((1 - L / 4) * (e.values[L:] @ e.values[:-L]) / n for L in range(1, 4))
            stat = dlt.mean() / np.sqrt(v / n) if v > 0 else np.nan
            p = float(2 * (1 - stats.norm.cdf(abs(stat)))) if np.isfinite(stat) else None
            wins = float((s.e_weighted.abs() < s.e_plain.abs()).mean())
            dm = {"n": int(n), "stat": float(stat), "p": p, "weighted_better_share": wins,
                  "promoted": bool(p is not None and p < 0.05 and stat < 0)}
        # current weighted consensus
        asof = b.note_date.max()
        current = {}
        cons = wh.consensus.get(t, {})
        for fy_full, blk in (cons.get("annual") or {}).items():
            fy = "FY" + fy_full[-2:]
            lat = _latest(bt, asof, fy)
            if len(lat) == 0:
                continue
            w = _weights(lat, scores, asof, None) if len(lat) else None
            current[fy] = {"plain_mean_notes": float(lat.eps.mean()), "weighted": float((lat.set_index("broker").eps * w).sum()),
                           "bloomberg_mean": (blk.get("bloomberg_consensus") or {}).get("EPS"), "n_brokers": int(len(lat)),
                           "weights": {k: round(float(v), 4) for k, v in w.items()}}
        paths = [{"broker": r.broker, "date": r.note_date.date().isoformat(), "fy": r.fy, "eps": r.eps,
                  "tp": None if pd.isna(r.target_price) else float(r.target_price), "rating": str(r.rating)}
                 for r in bt.sort_values("note_date").itertuples()]
        w_now = {}
        for fy, c in current.items():
            for br, v in c["weights"].items():
                w_now.setdefault(br, {})[fy] = v
        for row in league:
            row["weight_now"] = w_now.get(row["broker"], {})
        # Current views: every broker's latest note, compared with the Bloomberg mean today.
        views = []
        bbg = {("FY" + k[-2:]): (v.get("bloomberg_consensus") or {}).get("EPS") for k, v in (cons.get("annual") or {}).items()}
        for br, nb in bt.groupby("broker"):
            last_note = nb[nb.note_date == nb.note_date.max()]
            row = {"broker": br, "date": last_note.note_date.iloc[0].date().isoformat(), "rating": str(last_note.rating.iloc[0]),
                   "tp": None if pd.isna(last_note.target_price.iloc[0]) else float(last_note.target_price.iloc[0]),
                   "n_notes": int(nb.note_id.nunique()), "eps": {}, "vs_bbg": {},
                   "confidence": float(last_note.extraction_confidence.min()) if "extraction_confidence" in last_note else None,
                   "source": str(last_note.source_tag.iloc[0])}
            for r2 in last_note.itertuples():
                row["eps"][r2.fy] = float(r2.eps)
                if bbg.get(r2.fy):
                    row["vs_bbg"][r2.fy] = float(r2.eps / bbg[r2.fy] - 1)
            views.append(row)
        tps = [v["tp"] for v in views if v["tp"] and (pd.Timestamp(asof) - pd.Timestamp(v["date"])).days <= 120]
        out["tickers"][t] = {"league": sorted(league, key=lambda r: r["score"]), "actuals": actual, "views": views,
                             "tp_mean_120d": float(np.mean(tps)) if tps else None, "tp_n_120d": len(tps),
                             "scored": bool(len(err) >= 8), "n_scorable": int(len(err)),
                             "backtest": btdf.round(5).to_dict(orient="records") if len(btdf) else [],
                             "dm": dm, "current": current, "paths": paths,
                             "n_notes": int(bt.note_id.nunique()), "n_brokers": int(bt.broker.nunique()),
                             "date_range": [bt.note_date.min().date().isoformat(), bt.note_date.max().date().isoformat()]}
    return out
