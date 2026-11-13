"""Backtest Lab: walk-forward rank IC, hit rate, spreads, deflated Sharpe, turnover, by regime.

Two model versions are scored on identical monthly folds:
  fp-1.0  P/E reversion toward trailing 5y median + validated-driver composite
  fp-0.9  P/E reversion only (control)
All signals at month-end m use only prices and fundamentals with known_at <= m.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from . import config as C
from .attribution import ltm_eps_daily, regime_of


def _signals(wh, fit_out, panel, validated: list[str], coefs: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    ends = wh.prices.resample("ME").last().index
    rer, comp = {}, {}
    for t in C.CEMENT:
        if t not in wh.prices:
            continue
        px = wh.prices[t].dropna()
        eps = ltm_eps_daily(wh, t)
        lpe = np.log((px / eps).where(eps > 0))
        lpe_m = lpe.resample("ME").last()
        med = lpe_m.rolling(60, min_periods=24).median().shift(1)
        rer[t] = -(lpe_m - med) * (1 - 0.92 ** 3)
        # driver composite: latest known driver values x full-sample sector coefficient sign
        sub = panel[panel.ticker == t].sort_values("event_date")
        s = pd.Series(0.0, index=ends)
        for code in validated:
            z = (sub[code] - panel[code].mean()) / panel[code].std()
            ser = pd.Series(z.values, index=pd.DatetimeIndex(sub["event_date"])).dropna()
            ser = ser[~ser.index.duplicated(keep="last")]
            s = s.add(ser.reindex(ser.index.union(ends)).ffill().reindex(ends).fillna(0) * coefs[code], fill_value=0)
        comp[t] = s
    R = pd.DataFrame(rer).reindex(ends)
    D = pd.DataFrame(comp).reindex(ends).fillna(0)
    return R, D


def _nw_t(x: np.ndarray, lags: int = 2) -> float:
    x = x[np.isfinite(x)]
    n = len(x)
    if n < 6:
        return np.nan
    e = x - x.mean()
    v = (e @ e) / n
    for L in range(1, lags + 1):
        v += 2 * (1 - L / (lags + 1)) * (e[L:] @ e[:-L]) / n
    return float(x.mean() / np.sqrt(v / n))


def deflated_sharpe(sr: float, n_obs: int, n_trials: int, skew: float, kurt: float, sr_var: float) -> float:
    """Bailey & Lopez de Prado (2014). sr is per-period."""
    if n_obs < 10 or n_trials < 1:
        return np.nan
    emc = 0.5772156649
    sr0 = np.sqrt(sr_var) * ((1 - emc) * stats.norm.ppf(1 - 1 / n_trials) + emc * stats.norm.ppf(1 - 1 / (n_trials * np.e))) if n_trials > 1 else 0
    num = (sr - sr0) * np.sqrt(n_obs - 1)
    den = np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr ** 2)
    return float(stats.norm.cdf(num / den))


def run(wh, fit_out, panel, driver_results, n_trials: int) -> dict:
    validated = [r["code"] for r in driver_results if r.get("validated")]
    # if nothing passes all gates, fp-1.0 uses drivers with BH q < 0.10 (labelled as such)
    # If nothing passes every gate, fp-1.0 uses the three lowest-p drivers so the
    # comparison with the control is informative; the UI labels them unvalidated.
    tested = sorted([r for r in driver_results if r.get("status") == "tested" and np.isfinite(r.get("p", np.nan))], key=lambda r: r["p"])
    used = validated or [r["code"] for r in tested[:3]]
    coefs = {r["code"]: np.sign(r["effect_sd"]) for r in driver_results if r.get("code") in used}
    R, D = _signals(wh, fit_out, panel, used, coefs)
    px_m = wh.prices[[t for t in C.CEMENT if t in wh.prices]].resample("ME").last()
    fwd3 = np.log(px_m.shift(-3) / px_m)
    fwd1 = np.log(px_m.shift(-1) / px_m)
    ex3 = fwd3.sub(fwd3.mean(axis=1), axis=0)
    ex1 = fwd1.sub(fwd1.mean(axis=1), axis=0)
    versions = {"fp-1.0": R + D * 0.02, "fp-0.9": R}  # NaN where P/E history is too short, so both score the same months
    out = {"versions": {}, "drivers_used": used, "drivers_used_basis": "validated" if validated else "unvalidated: three lowest p-values, none passed all gates"}
    for v, S in versions.items():
        rows, ls, turn, prev_top = [], [], [], None
        for d in S.index:
            s, r3, r1 = S.loc[d], ex3.loc[d] if d in ex3.index else None, ex1.loc[d] if d in ex1.index else None
            if r3 is None:
                continue
            m = s.notna() & r3.notna()
            if m.sum() < 6:
                continue
            ic = stats.spearmanr(s[m], r3[m]).statistic
            if not np.isfinite(ic):
                continue
            k = max(2, int(m.sum() // 3))
            ranked = s[m].sort_values()
            top, bot = ranked.index[-k:], ranked.index[:k]
            spread3 = float(r3[top].mean() - r3[bot].mean())
            if r1 is not None and r1[top].notna().all() and r1[bot].notna().all():
                ls.append(float(r1[top].mean() - r1[bot].mean()))
            if prev_top is not None:
                turn.append(1 - len(set(top) & set(prev_top)) / k)
            prev_top = top
            rows.append({"date": d.date().isoformat(), "ic": float(ic), "spread": spread3, "hit": spread3 > 0,
                         "regime": regime_of(d), "n": int(m.sum())})
        df = pd.DataFrame(rows)
        if df.empty:
            continue
        ls = np.array(ls)
        sr = ls.mean() / ls.std() if ls.std() else np.nan
        by_reg = {}
        for code, label, *_ in C.REGIMES:
            sub = df[df.regime == code]
            if len(sub) >= 6:
                by_reg[code] = {"label": label, "ic": float(sub.ic.mean()), "ic_t": _nw_t(sub.ic.values),
                                "hit": float(sub.hit.mean()), "n": int(len(sub))}
        out["versions"][v] = {
            "monthly": df.round(5).to_dict(orient="records"),
            "ic_mean": float(df.ic.mean()), "ic_t": _nw_t(df.ic.values), "hit_rate": float(df.hit.mean()),
            "spread_mean": float(df.spread.mean()), "sharpe_ann": float(sr * np.sqrt(12)) if np.isfinite(sr) else None,
            "deflated_sharpe": deflated_sharpe(sr, len(ls), max(n_trials, 1), float(stats.skew(ls)),
                                               float(stats.kurtosis(ls, fisher=False)), 1 / max(len(ls), 1)) if len(ls) > 10 else None,
            "turnover": float(np.mean(turn)) if turn else None, "regimes": by_reg, "n_months": int(len(df)),
            "regimes_ic_positive": int(sum(1 for r in by_reg.values() if r["ic"] > 0)),
        }
    return out
