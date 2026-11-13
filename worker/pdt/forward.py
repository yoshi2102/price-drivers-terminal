"""Phase 3: forward return distributions per stock (Monte Carlo, 10,000 paths).

EPS paths are centred on consensus; the price already discounts consensus,
so only the surprise against it moves the stock:

log return(h) = required return (market beta x market expected return)
              + EPS surprise vs consensus x price elasticity (bootstrap draws)
              + P/E reversion toward 5-year median    (speed drawn from bootstrap)
              + systematic block bootstrap (market, sector, style; demeaned)
              + residual stock-specific noise
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C
from .attribution import ltm_eps_daily

H = {"3m": 3, "6m": 6, "12m": 12}
rng = np.random.default_rng(C.SEED)


def _fy_blend(cons: dict) -> tuple[float | None, float | None, dict]:
    """12-month-forward EPS and FY1->FY2 growth from Bloomberg consensus."""
    ann = cons.get("annual") or {}
    fys = sorted(k for k in ann if (ann[k].get("bloomberg_consensus") or {}).get("EPS"))
    if len(fys) < 2:
        return None, None, {}
    e1 = ann[fys[0]]["bloomberg_consensus"]["EPS"]
    e2 = ann[fys[1]]["bloomberg_consensus"]["EPS"]
    fy1_end = pd.Timestamp(f"{fys[0][2:]}-03-31")
    asof = pd.Timestamp((cons.get("bloomberg_updated") or {}).get("annual") or "2026-11-13")
    w = max(0.0, min(1.0, (fy1_end - asof).days / 365))
    fwd = w * e1 + (1 - w) * e2
    g = e2 / e1 - 1 if e1 and e1 > 0 else None
    return fwd, g, {"fy1": fys[0], "fy2": fys[1], "eps_fy1": e1, "eps_fy2": e2, "w_fy1": round(w, 3)}


def elasticity_and_reversion(wh) -> dict:
    """Pooled price-to-EPS elasticity (quarterly) and monthly P/E mean-reversion speed, with bootstrap draws."""
    dP, dE, devs = [], [], []
    for t in C.CEMENT:
        if t not in wh.prices:
            continue
        px = wh.prices[t].dropna()
        eps = ltm_eps_daily(wh, t)
        qq = wh.quarterly[wh.quarterly.ticker == t].sort_values("quarter_end")
        ltm_e = pd.Series(qq["ebitda_cr"].rolling(4).sum().values, index=pd.DatetimeIndex(qq["known_at"])).dropna()
        ltm_e = ltm_e[~ltm_e.index.duplicated(keep="last")]
        ebd = ltm_e.reindex(px.index.union(ltm_e.index)).ffill().reindex(px.index)
        qe = pd.DataFrame({"p": px, "e": ebd}).resample("QE").last().dropna().iloc[::-1].iloc[::4].iloc[::-1]  # annual, non-overlapping
        qe = qe[qe.e > 0]
        x = np.log(qe).diff().dropna()
        dP += list(x["p"]); dE += list(x["e"])
        pe = (px / eps)[eps > 0].resample("ME").last().dropna()
        lpe = np.log(pe)
        med = lpe.rolling(60, min_periods=24).median().shift(1)
        dev = (lpe - med).dropna()
        devs.append(dev)
    dP, dE = np.array(dP), np.array(dE)
    m = np.abs(dE) < 1.0
    dP, dE = dP[m], dE[m]
    el_draws, ph_draws = [], []
    n = len(dP)
    pairs = []
    for d in devs:
        pairs += list(zip(d.values[:-1], d.values[1:]))
    pairs = np.array(pairs)
    for _ in range(500):
        i = rng.integers(0, n, n)
        el_draws.append(np.cov(dP[i], dE[i])[0, 1] / np.var(dE[i]))
        j = rng.integers(0, len(pairs), len(pairs))
        a, b = pairs[j, 0], pairs[j, 1]
        ph_draws.append(np.clip((a * b).sum() / (a * a).sum(), 0.5, 0.999))
    el_draws = np.clip(el_draws, 0, 2)
    return {"elasticity": float(np.median(el_draws)), "elasticity_draws": np.array(el_draws),
            "phi": float(np.median(ph_draws)), "phi_draws": np.array(ph_draws),
            "n_quarters": int(n), "n_months": int(len(pairs))}


def block_bootstrap(series: np.ndarray, months: int, n: int, block: int = 21) -> np.ndarray:
    days = months * 21
    L = len(series)
    nb = int(np.ceil(days / block))
    starts = rng.integers(0, L - block, size=(n, nb))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(n, -1)[:, :days]
    return series[idx].sum(axis=1)


def run(wh, fit_out: dict, fac: pd.DataFrame, rets: pd.DataFrame, panel: pd.DataFrame) -> tuple[dict, dict]:
    er = elasticity_and_reversion(wh)
    calib = calibration(wh, fit_out)
    from scipy.stats import norm
    widen = {}
    for hk in ("3m", "12m"):
        cov = calib[hk]["coverage_80"] or 0.8
        widen[hk] = float(np.clip(1.2816 / norm.ppf(0.5 + cov / 2), 1.0, 1.6)) if cov < 0.78 else 1.0
    widen["6m"] = (widen["3m"] + widen["12m"]) / 2
    calib["widen"] = widen
    out, scen = {}, {}
    mkt = fac["market"].dropna()
    mkt_mu = float(mkt.mean() * 252)
    for t in C.CEMENT:
        if t not in fit_out or t not in wh.consensus:
            continue
        cons = wh.consensus[t]
        fwd, g, meta = _fy_blend(cons)
        px = wh.prices[t].dropna()
        p0 = float(px.iloc[-1])
        eps_ltm = ltm_eps_daily(wh, t)
        pe_series = (px / eps_ltm)[eps_ltm > 0]
        if g is None or pe_series.empty:
            continue
        g = float(np.clip(g, -0.3, 0.6))
        # Forward P/E now = price / 12m-forward consensus EPS. Historical forward
        # P/E proxy = price / LTM EPS realised 12 months later (perfect-foresight
        # forward EPS); it ends 12 months ago, so the band uses no unknown data
        # for today's forecast. This strips one-off items from the trailing P/E.
        pe_now = p0 / fwd
        eps_ahead = eps_ltm.shift(-252)
        fpe = (px / eps_ahead)[(eps_ahead > 0)].dropna().iloc[-1260:]
        # fair multiple = 1 / median earnings yield (robust to near-zero EPS years), kept within 0.6x-1.6x of today
        fair = float(1 / (1 / fpe).median()) if len(fpe) > 250 else float(1 / (1 / pe_series.iloc[-1260:]).median())
        fair = float(np.clip(fair, 0.6 * pe_now, 1.6 * pe_now))
        beta_m = float(fit_out[t]["betas"]["market"].iloc[-1])
        # Historical EPS growth error proxy: deviation of LTM EPS YoY growth from its trailing mean.
        q = wh.quarterly[wh.quarterly.ticker == t].sort_values("quarter_end")
        ltm = q["eps"].rolling(4).sum()
        gro = np.log(ltm.where(ltm > 0) / ltm.where(ltm > 0).shift(4))
        err = (gro - gro.shift(1).rolling(4, min_periods=3).mean()).dropna()
        sd_eps = float(np.clip(err.std() if len(err) >= 6 else 0.25, 0.10, 0.60))
        comps = fit_out[t]["components"]
        spec = comps["specific"].values[-756:]
        sysd = (comps["market"] + comps["sector"] + comps["style"]).values[-1764:]
        sysd = sysd - sysd.mean()
        mk = fac["market"].reindex(comps.index).values[-1764:]
        var_spec = float(np.var(spec) * 252)
        el_draws = rng.choice(er["elasticity_draws"], C.MC_PATHS)
        ph_draws = rng.choice(er["phi_draws"], C.MC_PATHS)
        sd_noise = np.sqrt(max(var_spec - (er["elasticity"] * sd_eps) ** 2, 0.3 * var_spec))
        res_h, sc_h = {}, {}
        for hk, m in H.items():
            n = C.MC_PATHS
            idx_blocks = rng.integers(0, len(sysd) - 21, size=(n, int(np.ceil(m))))
            sys_r = np.zeros(n); mk_r = np.zeros(n)
            for b in range(idx_blocks.shape[1]):
                ii = idx_blocks[:, b][:, None] + np.arange(21)[None, :]
                sys_r += sysd[ii].sum(axis=1)
                mk_r += np.nan_to_num(mk[ii]).sum(axis=1)
            mk_r = mk_r - mk_r.mean() + mkt_mu * m / 12
            growth = np.full(n, beta_m * mkt_mu * m / 12)
            surprise_eps = rng.normal(0, sd_eps * np.sqrt(m / 12), n)
            surprise = el_draws * surprise_eps
            kappa = -np.log(ph_draws)  # per month
            rer = (1 - np.exp(-kappa * m)) * (np.log(fair) - np.log(pe_now))
            noise = rng.normal(0, sd_noise * np.sqrt(m / 12), n)
            k = widen[hk]
            sys_r, noise, surprise, surprise_eps = sys_r * k, noise * k, surprise * k, surprise_eps * k
            total = growth + surprise + rer + sys_r + noise
            excess = total - mk_r
            pct = np.percentile(total, [10, 25, 50, 75, 90])
            comp = {"Required return (beta x market)": growth, "EPS surprise": surprise, "Re-rating": rer,
                    "Market, sector, style": sys_r, "Stock-specific noise": noise}
            vtot = sum(np.var(v) for v in comp.values())
            contrib = {k: round(float(np.var(v) / vtot), 4) if vtot else 0 for k, v in comp.items()}
            med = float(np.median(total))
            tornado = []
            for k, v in comp.items():
                if np.var(v) < 1e-10:
                    continue
                lo_v, hi_v = np.percentile(v, [10, 90])
                lo = float(np.median(total - v + lo_v)) - med
                hi = float(np.median(total - v + hi_v)) - med
                tornado.append({"input": k, "low": lo, "high": hi})
            # consensus growth lever
            dv = er["elasticity"] * np.log(1.10) * m / 12
            tornado.append({"input": "EPS 10% above / below consensus", "low": -dv, "high": dv})
            tornado.sort(key=lambda r: -(r["high"] - r["low"]))
            cuts = np.percentile(total, [25, 75])
            cases = []
            for name, mask, prob in [("Bear", total <= cuts[0], 0.25), ("Base", (total > cuts[0]) & (total < cuts[1]), 0.50),
                                     ("Bull", total >= cuts[1], 0.25)]:
                eg = np.log1p(g) * m / 12 + surprise_eps[mask]
                pe_end = pe_now * np.exp(total[mask] - eg)
                cases.append({"case": name, "probability": prob,
                              "eps_growth": float(np.expm1(np.mean(eg))),
                              "implied_pe": float(np.median(pe_end)),
                              "implied_price": float(p0 * np.exp(np.mean(total[mask]))),
                              "return": float(np.expm1(np.mean(total[mask])))})
            res_h[hk] = {"pct": {f"p{p}": float(np.expm1(v)) for p, v in zip([10, 25, 50, 75, 90], pct)},
                         "excess_pct": {f"p{p}": float(np.expm1(v)) for p, v in
                                        zip([10, 50, 90], np.percentile(excess, [10, 50, 90]))},
                         "p_beat_market": float((excess > 0).mean()), "contrib": contrib,
                         "tornado": tornado, "cases": cases,
                         "hist": np.histogram(np.expm1(total), bins=40)[0].tolist(),
                         "hist_edges": [round(float(x), 4) for x in np.histogram(np.expm1(total), bins=40)[1]]}
            k = 1000
            sc_h[hk] = {"growth": round(float(growth[0]), 6), "eps_drift": round(float(np.log1p(g) * m / 12), 6),
                        "rest": [round(float(x), 5) for x in (surprise + rer + sys_r + noise)[:k]],
                        "mkt": [round(float(x), 5) for x in mk_r[:k]],
                        "rer": [round(float(x), 5) for x in rer[:k]]}
        out[t] = {"price": p0, "price_date": px.index[-1].date().isoformat(), "pe_now": pe_now, "pe_fair": fair,
                  "eps_fwd": fwd, "eps_growth_cons": g, "sd_eps": sd_eps, "meta": meta,
                  "elasticity": er["elasticity"], "phi": er["phi"], "horizons": res_h,
                  "consensus_basis": "Bloomberg mean (Buoyant-weighted consensus not promoted)",
                  "pe_basis": "forward: price / 12m-forward consensus EPS; fair = 5y median of price / realised LTM EPS 12m later",
                  "widen": widen}
        scen[t] = {"price": p0, "eps_growth_cons": g, "elasticity": er["elasticity"], "horizons": sc_h}
    return {"stocks": out, "engine": {k: v for k, v in er.items() if not k.endswith("draws")},
            "calibration": calib, "market_mu": mkt_mu}, scen


def calibration(wh, fit_out: dict) -> dict:
    """PIT test of the price-only engine, walk-forward: at each quarter end, an
    80% band for the next 3/12 months built from data up to that date only."""
    res = {}
    for hk, m in [("3m", 3), ("12m", 12)]:
        days = m * 21
        pits = []
        for t in C.CEMENT:
            if t not in wh.prices:
                continue
            px = np.log(wh.prices[t].dropna())
            qe = px.resample("QE").last().index
            for d in qe:
                i = px.index.searchsorted(d)
                if i < 756 or i + days >= len(px):
                    continue
                hist = px.iloc[i - 756:i + 1].values
                hr = hist[days:] - hist[:-days]
                hr = hr - hr.mean() + np.log(1.10) * m / 12  # neutral drift
                real = px.iloc[i + days] - px.iloc[i]
                pits.append(float((hr <= real).mean()))
        pits = np.array(pits)
        cover = float(((pits > 0.1) & (pits < 0.9)).mean()) if len(pits) else None
        res[hk] = {"n": int(len(pits)), "coverage_80": cover,
                   "pit_hist": np.histogram(pits, bins=10, range=(0, 1))[0].tolist()}
    return res
