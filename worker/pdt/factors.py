"""1a. Factor model: market, sector, style. Output: stock-specific return series.

Betas are re-estimated every 21 trading days on the prior 504 days only, so
the residual on day t never uses returns after t-1.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf

from . import config as C

WIN, REFIT, MINOBS = 504, 21, 180


def daily_returns(px: pd.DataFrame) -> pd.DataFrame:
    return np.log(px).diff()


def build_factors(rets: pd.DataFrame) -> pd.DataFrame:
    mk = [t for t in C.MARKET_PROXY if t in rets]
    market = rets[mk].mean(axis=1, skipna=True).where(rets[mk].notna().sum(axis=1) >= 10)
    universe = [c for c in rets.columns]
    # Momentum 12-1 and low-vol, terciles over the covered universe, rebalanced monthly.
    cum = rets[universe].rolling(252, min_periods=200).sum() - rets[universe].rolling(21, min_periods=15).sum()
    vol = rets[universe].rolling(252, min_periods=200).std()
    month_end = rets.index.to_series().groupby(rets.index.to_period("M")).max()
    mom = pd.Series(np.nan, index=rets.index)
    lv = pd.Series(np.nan, index=rets.index)
    ends = list(month_end.values)
    for i in range(len(ends) - 1):
        d0, d1 = ends[i], ends[i + 1]
        sig_m, sig_v = cum.loc[d0].dropna(), vol.loc[d0].dropna()
        nxt = (rets.index > d0) & (rets.index <= d1)
        if len(sig_m) >= 12:
            hi, lo = sig_m[sig_m >= sig_m.quantile(2 / 3)].index, sig_m[sig_m <= sig_m.quantile(1 / 3)].index
            mom[nxt] = rets.loc[nxt, hi].mean(axis=1) - rets.loc[nxt, lo].mean(axis=1)
        if len(sig_v) >= 12:
            lo_v, hi_v = sig_v[sig_v <= sig_v.quantile(1 / 3)].index, sig_v[sig_v >= sig_v.quantile(2 / 3)].index
            lv[nxt] = rets.loc[nxt, lo_v].mean(axis=1) - rets.loc[nxt, hi_v].mean(axis=1)
    return pd.DataFrame({"market": market, "momentum": mom, "low_vol": lv})


def sector_loo(rets: pd.DataFrame, t: str) -> pd.Series:
    peers = [c for c in C.CEMENT if c in rets and c != t]
    return rets[peers].mean(axis=1, skipna=True)


def fit(rets: pd.DataFrame, fac: pd.DataFrame) -> dict:
    rf = np.log(1 + C.RISK_FREE_ANNUAL) / 252
    out = {}
    for t in C.CEMENT:
        if t not in rets:
            continue
        y = rets[t] - rf
        X = pd.DataFrame({"market": fac["market"] - rf,
                          "sector": sector_loo(rets, t) - fac["market"],
                          "momentum": fac["momentum"], "low_vol": fac["low_vol"]})
        df = pd.concat([y.rename("y"), X], axis=1)
        comps = pd.DataFrame(np.nan, index=df.index, columns=["market", "sector", "style", "specific", "total"])
        betas = pd.DataFrame(np.nan, index=df.index, columns=["alpha", "market", "sector", "momentum", "low_vol"])
        idx = df.index
        valid_from = df["y"].first_valid_index()
        start = idx.get_loc(valid_from) + MINOBS
        for i in range(start, len(idx), REFIT):
            train = df.iloc[max(0, i - WIN):i].dropna()
            if len(train) < MINOBS:
                continue
            A = np.column_stack([np.ones(len(train)), train[["market", "sector", "momentum", "low_vol"]].values])
            b, *_ = np.linalg.lstsq(A, train["y"].values, rcond=None)
            seg = df.iloc[i:i + REFIT]
            betas.iloc[i:i + REFIT] = b
            fm = b[1] * seg["market"]
            fs = b[2] * seg["sector"]
            fst = b[3] * seg["momentum"].fillna(0) + b[4] * seg["low_vol"].fillna(0)
            comps.iloc[i:i + REFIT, 0] = fm.values + rf
            comps.iloc[i:i + REFIT, 1] = fs.values
            comps.iloc[i:i + REFIT, 2] = fst.values
            comps.iloc[i:i + REFIT, 3] = (seg["y"] - fm - fs - fst).values
            comps.iloc[i:i + REFIT, 4] = (seg["y"] + rf).values
        comps = comps[comps["total"].notna() & comps["specific"].notna()]
        out[t] = {"components": comps, "betas": betas.ffill()}
    return out


def factor_cov(fac: pd.DataFrame) -> dict:
    x = fac.dropna().iloc[-756:]
    lw = LedoitWolf().fit(x.values)
    return {"factors": list(x.columns), "cov_annual": (lw.covariance_ * 252).round(6).tolist(),
            "shrinkage": round(float(lw.shrinkage_), 4), "n_days": int(len(x))}


def window_sum(comps: pd.DataFrame, start, end) -> dict | None:
    seg = comps[(comps.index > pd.Timestamp(start)) & (comps.index <= pd.Timestamp(end))]
    if len(seg) < 3:
        return None
    s = seg.sum()
    return {k: float(s[k]) for k in ["market", "sector", "style", "specific", "total"]}


def quarterly_decomposition(fit_out: dict) -> list[dict]:
    """Equal-weighted cement basket per calendar quarter, in log-return points."""
    rows = []
    allc = pd.concat({t: v["components"] for t, v in fit_out.items()}, axis=1)
    qs = allc.index.to_period("Q").unique()
    for q in qs:
        seg = allc[allc.index.to_period("Q") == q]
        if len(seg) < 40:
            continue
        per = {}
        for comp in ["market", "sector", "style", "specific", "total"]:
            sub = seg.xs(comp, axis=1, level=1)
            per[comp] = float(sub.sum().mean())
        fy = q.year + (1 if q.quarter >= 2 else 0)
        fyq = f"FY{fy % 100:02d}Q{q.quarter - 1 if q.quarter >= 2 else 4}"
        rows.append({"quarter": str(q), "fiscal_quarter": fyq, **{k: round(v, 5) for k, v in per.items()}})
    return rows


def share_explained(comps: pd.DataFrame, days: int = 756) -> dict:
    """Variance share of each component over the window (covariance attribution)."""
    seg = comps.iloc[-days:]
    tot = seg["total"].var()
    if not tot:
        return {}
    return {k: round(float(seg[k].cov(seg["total"]) / tot), 4) for k in ["market", "sector", "style", "specific"]}
