"""Phase 1 engines: 1b earnings vs re-rating, 1c event studies, 1d panel
regressions, 1e driver discovery, 1f lead/lag, plus the validation gates."""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

from . import config as C
from .ingest import prev_period

warnings.filterwarnings("ignore")
rng = np.random.default_rng(C.SEED)

DRIVERS = {
    # code: (label, unit for raw sensitivity, expected sign, group)
    "volume_growth": ("Volume growth YoY", "1 pp", +1, "KPI"),
    "volume_surprise": ("Volume growth surprise", "1 pp", +1, "Surprise"),
    "realisation_yoy": ("Realisation per tonne YoY", "1%", +1, "KPI"),
    "cost_per_t_yoy": ("Cost per tonne YoY", "1%", -1, "KPI"),
    "ebitda_per_t_yoy": ("EBITDA per tonne change YoY", "₹100/t", +1, "KPI"),
    "revenue_sue": ("Revenue surprise (SUE)", "1 SD", +1, "Surprise"),
    "ebitda_sue": ("EBITDA surprise (SUE)", "1 SD", +1, "Surprise"),
    "pat_sue": ("PAT surprise (SUE)", "1 SD", +1, "Surprise"),
    "ebitda_margin_chg": ("EBITDA margin change YoY", "100 bp", +1, "KPI"),
    "power_fuel_per_t_yoy": ("Power & fuel cost per tonne YoY", "1%", -1, "KPI"),
    "petcoke_chg": ("Pet coke price, quarter change", "1%", -1, "Macro"),
    "coal_chg": ("Thermal coal (Indonesia), quarter change", "1%", -1, "Macro"),
    "brent_chg": ("Brent crude, quarter change", "1%", -1, "Macro"),
    "inr_chg": ("INR per USD, quarter change", "1%", -1, "Macro"),
    "prior_specific_3m": ("Prior 3-month stock-specific return", "1%", 0, "Price"),
    # Street surprises: actual against expectations published before results.
    "street_revenue_surprise": ("Revenue vs street expectation", "1 pp", +1, "Street"),
    "street_ebitda_surprise": ("EBITDA vs street expectation", "1 pp", +1, "Street"),
    "street_pat_surprise": ("PAT vs street expectation", "1 pp", +1, "Street"),
    "street_volume_surprise": ("Volume vs street expectation", "1 pp", +1, "Street"),
    # IT services KPIs (priors from the Buoyant IT services sector skill: growth, deals, margin, guidance).
    "cc_growth_qoq": ("Constant-currency growth QoQ", "1 pp", +1, "KPI"),
    "cc_growth_surprise": ("CC growth vs own trend", "1 pp", +1, "Surprise"),
    "usd_rev_growth_yoy": ("USD revenue growth YoY", "1 pp", +1, "KPI"),
    "tcv_growth_yoy": ("Deal TCV growth YoY (trailing 4Q)", "1%", +1, "KPI"),
    "headcount_growth_qoq": ("Headcount growth QoQ", "1%", +1, "KPI"),
    "attrition_chg": ("Attrition change YoY", "1 pp", -1, "KPI"),
    "ebit_margin_chg": ("EBIT margin change YoY", "100 bp", +1, "KPI"),
    "guidance_mid_chg": ("Revenue guidance midpoint change", "1 pp", +1, "KPI"),
}
COMMON = ["revenue_sue", "ebitda_sue", "pat_sue", "ebitda_margin_chg", "prior_specific_3m",
          "street_revenue_surprise", "street_ebitda_surprise", "street_pat_surprise", "inr_chg"]
DRIVER_SETS = {
    "cement": COMMON + ["volume_growth", "volume_surprise", "realisation_yoy", "cost_per_t_yoy", "ebitda_per_t_yoy",
                        "power_fuel_per_t_yoy", "petcoke_chg", "coal_chg", "brent_chg", "street_volume_surprise"],
    "it-services": COMMON + ["cc_growth_qoq", "cc_growth_surprise", "usd_rev_growth_yoy", "tcv_growth_yoy",
                             "headcount_growth_qoq", "attrition_chg", "ebit_margin_chg", "guidance_mid_chg"],
}
# A weaker rupee raises cement's imported fuel costs but lifts IT exporters' rupee revenue.
SIGN_OVERRIDE = {("it-services", "inr_chg"): +1}


def active_drivers() -> list[str]:
    return DRIVER_SETS[C.SECTOR]


def sign_for(code: str) -> int:
    return SIGN_OVERRIDE.get((C.SECTOR, code), DRIVERS[code][2])
RAW_SCALE = {"volume_growth": 100, "volume_surprise": 100, "realisation_yoy": 100, "cost_per_t_yoy": 100,
             "ebitda_per_t_yoy": 0.01, "ebitda_margin_chg": 1, "power_fuel_per_t_yoy": 100,
             "petcoke_chg": 100, "coal_chg": 100, "brent_chg": 100, "inr_chg": 100, "prior_specific_3m": 100,
             "revenue_sue": 1, "ebitda_sue": 1, "pat_sue": 1,
             "street_revenue_surprise": 100, "street_ebitda_surprise": 100, "street_pat_surprise": 100, "street_volume_surprise": 100,
             "cc_growth_qoq": 100, "cc_growth_surprise": 100, "usd_rev_growth_yoy": 100, "tcv_growth_yoy": 100,
             "headcount_growth_qoq": 100, "attrition_chg": 1, "ebit_margin_chg": 1, "guidance_mid_chg": 1}


def regime_of(d: pd.Timestamp) -> str:
    for code, _, a, b in C.REGIMES:
        if pd.Timestamp(a) <= d <= pd.Timestamp(b):
            return code
    return "post_2023"


# ------------------------------------------------------------ driver panel

def _sue(g: pd.Series) -> pd.Series:
    exp = g.shift(1).rolling(4, min_periods=3).mean()
    sd = (g - exp).shift(1).rolling(8, min_periods=4).std()
    sd = sd.fillna(g.shift(1).rolling(8, min_periods=4).std())
    return (g - exp) / sd.replace(0, np.nan)


def _quarter_avg(s: pd.Series) -> pd.Series:
    q = s.groupby(s.index.to_period("Q")).mean()
    return q


def _it_kpis(wh, t: str, periods) -> pd.DataFrame:
    """IT KPI features for one stock, aligned to its fiscal quarters."""
    k = getattr(wh, "kpi_long", pd.DataFrame())
    k = k[(k.ticker == t)] if len(k) else k
    w = k.pivot_table(index="period", columns="kpi_code", values="value", aggfunc="first") if len(k) else pd.DataFrame()
    allp = sorted(set(periods) | set(w.index), key=lambda p: (int(p[2:4]), int(p[-1])))
    w = w.reindex(allp)
    g = lambda c: w[c] if c in w else pd.Series(np.nan, index=w.index)
    lagn = lambda s, n: s.reindex([prev_period(p, n) for p in s.index]).set_axis(s.index)
    out = pd.DataFrame(index=w.index)
    with np.errstate(all="ignore"):
        cc = g("cc_growth_qoq_pct") / 100
        out["cc_growth_qoq"] = cc
        out["cc_growth_surprise"] = cc - cc.shift(1).rolling(4, min_periods=3).mean()
        usd = g("usd_revenue_mn")
        out["usd_rev_growth_yoy"] = np.log(usd / lagn(usd, 4))
        tcv = g("tcv_usd_mn")
        t4 = tcv.rolling(4, min_periods=4).sum()
        out["tcv_growth_yoy"] = np.log(t4 / lagn(t4, 4))
        hc = g("headcount")
        out["headcount_growth_qoq"] = np.log(hc / lagn(hc, 1))
        at = g("attrition_ltm_pct")
        out["attrition_chg"] = at - lagn(at, 4)
        em = g("ebit_margin_pct")
        out["ebit_margin_chg"] = em - lagn(em, 4)
        mid = (g("guidance_low_pct") + g("guidance_high_pct")) / 2
        out["guidance_mid_chg"] = mid - mid.shift(1)
    return out.replace([np.inf, -np.inf], np.nan).reindex(periods)


def build_panel(wh, fit_out: dict) -> pd.DataFrame:
    q = wh.quarterly[wh.quarterly.ticker.isin(list(C.UNIVERSE))].copy()
    rows = []
    trading = wh.prices.index
    comm = {k: _quarter_avg(v) for k, v in wh.commodities.items()}
    for t, sub in q.groupby("ticker"):
        sub = sub.sort_values("quarter_end").set_index("period")
        lag4 = lambda col: sub[col].reindex([prev_period(p, 4) for p in sub.index]).values
        rev, ebitda, pat, vol = sub["revenue_cr"], sub["ebitda_cr"], sub["pat_cr"], sub["volume_mt"]
        d = pd.DataFrame(index=sub.index)
        d["ticker"] = t
        d["quarter_end"] = sub["quarter_end"]
        d["event_date"] = sub["known_at"]
        d["date_source"] = sub["known_at_source"]
        d["kpi_known_at"] = sub["kpi_known_at"]
        with np.errstate(all="ignore"):
            d["revenue_yoy"] = np.log(rev.values / lag4("revenue_cr"))
            d["ebitda_yoy"] = np.log(np.clip(ebitda.values, 1e-6, None) / np.clip(lag4("ebitda_cr"), 1e-6, None))
            d["pat_yoy"] = (pat.values - lag4("pat_cr")) / np.abs(lag4("pat_cr"))
            d["ebitda_margin_chg"] = 100 * (ebitda.values / rev.values - lag4("ebitda_cr") / lag4("revenue_cr"))
            d["volume_growth"] = np.log(vol.values / lag4("volume_mt"))
            real, real4 = rev.values / vol.values, lag4("revenue_cr") / lag4("volume_mt")
            d["realisation_yoy"] = np.log(real / real4)
            cpt, cpt4 = (rev.values - ebitda.values) / vol.values, (lag4("revenue_cr") - lag4("ebitda_cr")) / lag4("volume_mt")
            d["cost_per_t_yoy"] = np.log(cpt / cpt4)
            d["ebitda_per_t"] = ebitda.values * 10 / vol.values  # cr / mt -> Rs per tonne x 1e7/1e6 = x10
            d["ebitda_per_t_yoy"] = d["ebitda_per_t"] - lag4("ebitda_cr") * 10 / lag4("volume_mt")
            pf = sub["power_fuel_cr"]
            d["power_fuel_per_t_yoy"] = np.log((pf.values / vol.values) / (lag4("power_fuel_cr") / lag4("volume_mt")))
            d["realisation"] = rev.values * 10 / vol.values  # Rs per tonne
        for c in ["revenue_yoy", "ebitda_yoy", "pat_yoy"]:
            d[c.replace("_yoy", "_sue")] = _sue(d[c].replace([np.inf, -np.inf], np.nan))
        d["volume_surprise"] = d["volume_growth"] - d["volume_growth"].shift(1).rolling(4, min_periods=3).mean()
        # Macro: quarter-average change for the fiscal quarter itself (public by quarter end).
        per = pd.PeriodIndex(sub["quarter_end"], freq="Q")
        for code, key in [("petcoke_chg", "petcoke"), ("coal_chg", "coal_indonesia"), ("brent_chg", "brent"),
                          ("inr_chg", "inrusd")]:
            if key in comm:
                s = comm[key]
                d[code] = np.log(s.reindex(per).values / s.reindex(per - 1).values)
            else:
                d[code] = np.nan
        comps = fit_out.get(t, {}).get("components")
        ys = {k: [] for k in ["y_react", "y_drift", "y_window", "prior_specific_3m", "y_next"]}
        for ev in d["event_date"]:
            if comps is None or pd.isna(ev):
                for k in ys: ys[k].append(np.nan)
                continue
            spec = comps["specific"]
            pos = spec.index.searchsorted(ev)  # first trading day >= event
            def win(a, b):
                i0, i1 = pos + a, pos + b
                if i0 < 1 or i1 >= len(spec):
                    return np.nan
                return float(spec.iloc[i0:i1 + 1].sum())
            ys["y_react"].append(win(-1, 3))
            ys["y_drift"].append(win(4, 60))
            ys["y_window"].append(win(-1, 60))
            ys["prior_specific_3m"].append(win(-64, -2))
            ys["y_next"].append(win(61, 121))
        for k, v in ys.items():
            d[k] = v
        d["rev_cr"], d["ebitda_cr"], d["pat_cr"], d["volume_mt"], d["eps"] = rev, ebitda, pat, vol, sub["eps"]
        if C.SECTOR == "it-services":
            it = _it_kpis(wh, t, list(d.index))
            for c in it.columns:
                d[c] = it[c].values
        rows.append(d.reset_index())
    panel = pd.concat(rows, ignore_index=True).replace([np.inf, -np.inf], np.nan)
    for c in DRIVERS:
        if c not in panel and not c.startswith("street_"):
            panel[c] = np.nan
    panel = add_street_surprises(panel, getattr(wh, "expectations", pd.DataFrame()))
    panel["regime"] = panel["event_date"].map(regime_of)
    panel["tidx"] = panel["period"].map(lambda p: int(p[2:4]) * 4 + int(p[-1]))
    return panel


PRIORITY = {"bloomberg_consensus": 0, "consensus_in_review": 1, "broker_preview": 2}


def add_street_surprises(panel: pd.DataFrame, exp: pd.DataFrame) -> pd.DataFrame:
    """Actual result against the best expectation published before the results date.
    Bloomberg consensus beats consensus quoted in reviews, which beats broker previews;
    several sources of the chosen type are averaged."""
    cols = {"street_revenue_surprise": ("rev_cr", "revenue_cr"), "street_ebitda_surprise": ("ebitda_cr", "ebitda_cr"),
            "street_pat_surprise": ("pat_cr", "pat_cr"), "street_volume_surprise": ("volume_mt", "volume_mt")}
    for c in cols:
        panel[c] = np.nan
    panel["street_source"] = None
    if exp is None or exp.empty:
        return panel
    exp = exp.copy()
    exp["prio"] = exp["expectation_type"].map(PRIORITY).fillna(3)
    for i, r in panel.iterrows():
        e = exp[(exp.ticker == r.ticker) & (exp.period == r.period)]
        if pd.notna(r.event_date):
            e = e[e.source_date.isna() | (e.source_date < r.event_date)]
        if e.empty:
            continue
        e = e[e.prio == e.prio.min()]
        panel.at[i, "street_source"] = e.expectation_type.iloc[0]
        for c, (a, x) in cols.items():
            ev = e[x].dropna().mean() if x in e else np.nan
            av = r[a]
            if pd.notna(ev) and pd.notna(av) and abs(ev) > 1e-9:
                panel.at[i, c] = (av - ev) / abs(ev)
    return panel


# ------------------------------------------------------------ panel tests

def _fe_design(df: pd.DataFrame, xcols: list[str], time_fe=True):
    X = df[xcols].astype(float)
    dums = [pd.get_dummies(df["ticker"], prefix="s", drop_first=True, dtype=float)]
    if time_fe:
        dums.append(pd.get_dummies(df["period"], prefix="t", drop_first=True, dtype=float))
    X = pd.concat([X] + dums, axis=1)
    return sm.add_constant(X, has_constant="add")


def _ols_fe(df, xcols, y="y_window", time_fe=True, cluster=True):
    X = _fe_design(df, xcols, time_fe)
    m = sm.OLS(df[y].astype(float), X)
    if cluster:
        g = np.column_stack([pd.factorize(df["ticker"])[0], pd.factorize(df["period"])[0]])
        try:
            return m.fit(cov_type="cluster", cov_kwds={"groups": g})
        except Exception:
            return m.fit(cov_type="HC1")
    return m.fit()


def _fast_beta(y, x, sid):
    # within-stock demeaned slope (stock FE), for placebo/rolling speed
    df = pd.DataFrame({"y": y, "x": x, "s": sid})
    df["y"] -= df.groupby("s")["y"].transform("mean")
    df["x"] -= df.groupby("s")["x"].transform("mean")
    vx = (df["x"] ** 2).sum()
    return float((df["x"] * df["y"]).sum() / vx) if vx > 0 else np.nan


def test_driver(panel: pd.DataFrame, code: str) -> dict | None:
    df = panel.dropna(subset=[code, "y_window"]).copy()
    n_stocks, n_obs = df["ticker"].nunique(), len(df)
    if n_obs < 25 or n_stocks < 3:
        return {"code": code, "n_obs": int(n_obs), "n_stocks": int(n_stocks), "status": "insufficient"}
    sd = df[code].std()
    df["z"] = (df[code] - df[code].mean()) / sd
    # Macro series are identical across stocks within a quarter, so quarter
    # fixed effects would absorb them; they get stock FE only.
    tfe = DRIVERS[code][3] != "Macro"
    full = _ols_fe(df, ["z"], time_fe=tfe)
    base = _ols_fe(df, [], time_fe=tfe, cluster=False)
    b, se, p = float(full.params["z"]), float(full.bse["z"]), float(full.pvalues["z"])
    ci90 = (b - 1.645 * se, b + 1.645 * se)
    inc_r2 = float(full.rsquared - base.rsquared)
    raw_unit = RAW_SCALE.get(code, 1)
    sens = b / sd / raw_unit if sd else np.nan  # return per raw unit

    # Walk-forward OOS incremental R2 (expanding, refit each quarter, stock FE only)
    folds = []
    tq = sorted(df["tidx"].unique())
    for k in tq[8:]:
        tr, te = df[df.tidx < k - 1], df[df.tidx == k]  # 1-quarter embargo (windows overlap ~60d)
        if len(tr) < 20 or len(te) < 3:
            continue
        beta = _fast_beta(tr["y_window"], tr["z"], tr["ticker"])
        mu = tr.groupby("ticker")["y_window"].mean()
        xm = tr.groupby("ticker")["z"].mean()
        base_pred = te["ticker"].map(mu).fillna(tr["y_window"].mean())
        pred = base_pred + beta * (te["z"] - te["ticker"].map(xm).fillna(0))
        sse_b, sse_m = ((te["y_window"] - base_pred) ** 2).sum(), ((te["y_window"] - pred) ** 2).sum()
        folds.append(float(1 - sse_m / sse_b) if sse_b > 0 else 0.0)
    oos_share = float(np.mean([f > 0 for f in folds])) if folds else np.nan
    oos_mean = float(np.mean(folds)) if folds else np.nan

    # Regime stability
    regimes = {}
    for code_r, label, *_ in C.REGIMES:
        sub = df[df.regime == code_r]
        if len(sub) >= 12 and sub["ticker"].nunique() >= 3:
            regimes[code_r] = {"label": label, "beta": _fast_beta(sub["y_window"], sub["z"], sub["ticker"]),
                               "n": int(len(sub))}
    signs = [np.sign(v["beta"]) for v in regimes.values() if np.isfinite(v["beta"])]
    same_sign = sum(s == np.sign(b) for s in signs)
    # Rolling 12-quarter coefficient
    rolling = []
    for k in tq[11:]:
        sub = df[(df.tidx > k - 12) & (df.tidx <= k)]
        if len(sub) >= 20:
            per = sub.loc[sub.tidx == k, "period"].iloc[0] if (sub.tidx == k).any() else None
            rolling.append({"period": per, "beta": round(_fast_beta(sub["y_window"], sub["z"], sub["ticker"]), 5)})

    # Placebo: shuffle driver values within stock (breaks timing, keeps distribution)
    real = abs(_fast_beta(df["y_window"], df["z"], df["ticker"]))
    plac = []
    zs = df[["ticker", "z"]].copy()
    for _ in range(300):
        sh = zs.groupby("ticker")["z"].transform(lambda s: rng.permutation(s.values))
        plac.append(abs(_fast_beta(df["y_window"], sh, df["ticker"])))
    placebo_pct = float(stats.percentileofscore(plac, real))

    # Lead / lag: does the driver predict the NEXT window (61..121 days)?
    lead = None
    dl = df.dropna(subset=["y_next"])
    if len(dl) >= 25:
        lf = _ols_fe(dl, ["z"], y="y_next", time_fe=tfe)
        lead = {"beta": float(lf.params["z"]), "p": float(lf.pvalues["z"])}
    # Reaction vs drift split
    split = {}
    for yv in ["y_react", "y_drift"]:
        dd = df.dropna(subset=[yv])
        if len(dd) >= 25:
            r = _ols_fe(dd, ["z"], y=yv, time_fe=tfe)
            split[yv] = {"beta": float(r.params["z"]), "p": float(r.pvalues["z"])}

    label, unit, _, group = DRIVERS[code]
    prior_sign = sign_for(code)
    return {
        "code": code, "label": label, "group": group, "unit": unit,
        "prior": code in C.PRIOR_DRIVERS, "expected_sign": prior_sign,
        "effect_sd": b, "se": se, "ci90": ci90, "p": p, "t": b / se if se else np.nan,
        "sensitivity_per_unit": sens, "driver_sd": float(sd),
        "incremental_r2": inc_r2, "oos_fold_share": oos_share, "oos_mean_r2": oos_mean, "n_folds": len(folds),
        "regimes": regimes, "regime_same_sign": int(same_sign), "regime_n": len(signs),
        "rolling": rolling, "placebo_pct": placebo_pct, "lead": lead, "split": split,
        "n_obs": int(n_obs), "n_stocks": int(n_stocks), "status": "tested",
    }


def bh_adjust(pvals: list[float]) -> list[float]:
    p = np.nan_to_num(np.asarray(pvals, float), nan=1.0)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / (np.arange(n) + 1)
    adj = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.minimum(adj, 1)
    return out.tolist()


def apply_gates(results: list[dict]) -> list[dict]:
    tested = [r for r in results if r.get("status") == "tested"]
    adj = bh_adjust([r["p"] for r in tested])
    A = C.ACCEPTANCE
    for r, q in zip(tested, adj):
        r["q"] = q
        sign_ok = r["expected_sign"] == 0 or np.sign(r["effect_sd"]) == r["expected_sign"]
        gates = {
            "sign": {"pass": bool(sign_ok and r["expected_sign"] != 0),
                     "value": "matches prior" if sign_ok and r["expected_sign"] != 0 else
                     ("no written prior" if r["expected_sign"] == 0 else "opposite to prior")},
            "bh": {"pass": bool(q < A["bh_q"]), "value": round(q, 3)},
            "oos": {"pass": bool(np.isfinite(r["oos_fold_share"]) and r["oos_fold_share"] >= A["oos_fold_share"]),
                    "value": round(r["oos_fold_share"], 2) if np.isfinite(r["oos_fold_share"]) else None},
            "regime": {"pass": bool(r["regime_n"] >= 3 and r["regime_same_sign"] >= min(3, r["regime_n"])),
                       "value": f"{r['regime_same_sign']}/{r['regime_n']}"},
            "placebo": {"pass": bool(r["placebo_pct"] >= A["placebo_pct"]), "value": round(r["placebo_pct"], 1)},
            "sample": {"pass": bool(r["n_stocks"] >= A["min_stocks"] and r["n_obs"] >= A["min_obs"]),
                       "value": f"{r['n_stocks']} stocks, {r['n_obs']} obs"},
        }
        r["gates"] = gates
        r["validated"] = all(g["pass"] for g in gates.values())
        same = r["regime_same_sign"] / r["regime_n"] if r["regime_n"] else 0
        r["stability"] = "stable" if same == 1 and r["regime_n"] >= 2 else ("regime-dependent" if same >= 0.5 else "unstable")
        lead = r.get("lead")
        if lead and lead["p"] < 0.10 and np.sign(lead["beta"]) == np.sign(r["effect_sd"]):
            r["leads"] = "Yes, about 1 quarter"
        elif r.get("split", {}).get("y_drift", {}).get("p", 1) < 0.10:
            r["leads"] = "Drifts after results"
        else:
            r["leads"] = "Coincident"
        r["label_status"] = "validated" if r["validated"] else ("unstable" if r["stability"] == "unstable" else "unvalidated")
    return results


def stock_effects(panel: pd.DataFrame, sector_results: list[dict]) -> dict:
    """Per-stock driver coefficients shrunk toward the sector estimate (empirical Bayes)."""
    out = {}
    for r in sector_results:
        if r.get("status") != "tested":
            continue
        code = r["code"]
        df = panel.dropna(subset=[code, "y_window"])
        sd = r["driver_sd"]
        rows = {}
        for t, sub in df.groupby("ticker"):
            if len(sub) < 6:
                continue
            x = (sub[code] - df[code].mean()) / sd
            X = sm.add_constant(x.values)
            m = sm.OLS(sub["y_window"].values, X).fit()
            rows[t] = (float(m.params[1]), float(m.bse[1]), len(sub))
        if not rows:
            continue
        b_s = np.array([v[0] for v in rows.values()])
        se_s = np.array([v[1] for v in rows.values()])
        tau2 = max(np.var(b_s) - np.mean(se_s ** 2), 1e-6)
        for (t, (b, se, n)) in rows.items():
            w = tau2 / (tau2 + se ** 2)
            shr = r["effect_sd"] + w * (b - r["effect_sd"])
            out.setdefault(t, {})[code] = {"raw": b, "se": se, "shrunk": shr, "weight": w, "n": n,
                                            "departs": bool(np.sign(b) != np.sign(r["effect_sd"]) and abs(b / se) > 1.645)}
    return out


# ------------------------------------------------------------ discovery models

def discovery(panel: pd.DataFrame, codes: list[str]) -> dict:
    from sklearn.linear_model import ElasticNetCV
    from sklearn.preprocessing import StandardScaler
    import lightgbm as lgb
    import shap

    feats = []
    df = panel.sort_values(["ticker", "tidx"]).copy()
    for c in codes:
        feats.append(c)
        for L in (1, 2):
            df[f"{c}_lag{L}"] = df.groupby("ticker")[c].shift(L)
            feats.append(f"{c}_lag{L}")
    df = df.dropna(subset=["y_window"])
    # demean by stock (stock FE) and fill missing with 0 after standardising
    X = df[feats].copy()
    X = (X - X.mean()) / X.std()
    avail = X.notna().mean()
    keep = [f for f in feats if avail[f] >= 0.5]
    X = X[keep].fillna(0)
    y = df["y_window"] - df.groupby("ticker")["y_window"].transform("mean")
    t = df["tidx"].values
    # Purged walk-forward folds: train strictly before test quarter minus 1 embargo quarter
    tq = sorted(set(t))
    preds_lin, preds_gbm, ys = [], [], []
    for k in tq[10:]:
        tr, te = t < k - 1, t == k
        if tr.sum() < 40 or te.sum() < 3:
            continue
        en = ElasticNetCV(l1_ratio=[0.2, 0.5, 0.8], cv=4, max_iter=5000).fit(X[tr], y[tr])
        gb = lgb.LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=7, min_child_samples=12,
                               subsample=0.8, colsample_bytree=0.8, verbose=-1, random_state=C.SEED).fit(X[tr], y[tr])
        preds_lin += list(en.predict(X[te])); preds_gbm += list(gb.predict(X[te])); ys += list(y[te])
    ys, pl, pg = np.array(ys), np.array(preds_lin), np.array(preds_gbm)
    sst = ((ys - 0) ** 2).sum()
    oos_lin = float(1 - ((ys - pl) ** 2).sum() / sst) if len(ys) else np.nan
    oos_gbm = float(1 - ((ys - pg) ** 2).sum() / sst) if len(ys) else np.nan
    en = ElasticNetCV(l1_ratio=[0.2, 0.5, 0.8], cv=4, max_iter=5000).fit(X, y)
    gb = lgb.LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=7, min_child_samples=12,
                           subsample=0.8, colsample_bytree=0.8, verbose=-1, random_state=C.SEED).fit(X, y)
    sv = shap.TreeExplainer(gb).shap_values(X)
    shap_imp = sorted([{"feature": f, "mean_abs_shap": float(np.abs(sv[:, i]).mean()),
                        "corr_sign": float(np.sign(np.corrcoef(X[f], sv[:, i])[0, 1])) if X[f].std() > 0 else 0}
                       for i, f in enumerate(keep)], key=lambda r: -r["mean_abs_shap"])
    # partial dependence for top linear features (binned)
    pdp = {}
    for f in [r["feature"] for r in shap_imp[:4]]:
        bins = pd.qcut(X[f].rank(method="first"), 5, labels=False)
        pdp[f] = [{"bin": int(b), "x": float(X[f][bins == b].mean()), "shap": float(sv[bins == b, keep.index(f)].mean())}
                  for b in range(5)]
    return {
        "n_obs": int(len(df)), "features": keep,
        "elastic_net": {"alpha": float(en.alpha_), "l1_ratio": float(en.l1_ratio_),
                        "coefs": sorted([{"feature": f, "coef": float(c)} for f, c in zip(keep, en.coef_)],
                                        key=lambda r: -abs(r["coef"])),
                        "in_sample_r2": float(en.score(X, y)), "oos_r2": oos_lin},
        "gbm": {"in_sample_r2": float(gb.score(X, y)), "oos_r2": oos_gbm,
                "kept": bool(np.isfinite(oos_gbm) and np.isfinite(oos_lin) and oos_gbm > oos_lin + 0.02),
                "shap": shap_imp[:15], "pdp": pdp},
        "n_test": int(len(ys)),
    }


# ------------------------------------------------------------ event studies

def event_study(panel: pd.DataFrame, fit_out: dict, metric: str, require_dates: bool = True) -> dict:
    df = panel.dropna(subset=[metric]).copy()
    if require_dates:
        df = df[df.date_source == "results_date"]
    curves, recs = [], []
    for _, r in df.iterrows():
        comps = fit_out.get(r.ticker, {}).get("components")
        if comps is None:
            continue
        spec = comps["specific"]
        pos = spec.index.searchsorted(r.event_date)
        if pos - 5 < 252 or pos + 60 >= len(spec):
            continue
        path = spec.iloc[pos - 5:pos + 61].values
        est_sd = spec.iloc[pos - 252:pos - 10].std()
        car = np.concatenate([[0], np.cumsum(path[1:])])
        recs.append({"ticker": r.ticker, "period": r.period, "date": r.event_date, "surprise": r[metric],
                     "react": float(path[4:9].sum()), "drift": float(path[9:66].sum()), "sd": float(est_sd),
                     "regime": "since_2023" if r.event_date >= pd.Timestamp("2023-01-01") else "before_2023"})
        curves.append(car)
    if len(recs) < 15:
        return {"metric": metric, "n": len(recs), "status": "insufficient"}
    ev = pd.DataFrame(recs)
    curves = np.array(curves)
    ev["q"] = pd.qcut(ev["surprise"].rank(method="first"), 5, labels=False)
    ev["week"] = ev["date"].dt.to_period("W").astype(str)
    days = list(range(-5, 61))
    buckets = []
    for b in range(5):
        m = (ev["q"] == b).values
        mean_curve = curves[m].mean(axis=0)
        # cluster bootstrap by results week
        weeks = ev.loc[m, "week"].values
        uw = np.unique(weeks)
        boots = []
        for _ in range(400):
            pick = rng.choice(uw, len(uw), replace=True)
            idx = np.concatenate([np.where(weeks == w)[0] for w in pick])
            boots.append(curves[m][idx].mean(axis=0))
        lo, hi = np.percentile(boots, [5, 95], axis=0)
        buckets.append({"quintile": b + 1, "n": int(m.sum()),
                        "surprise_mean": float(ev.loc[m, "surprise"].mean()),
                        "curve": [round(float(x), 5) for x in mean_curve],
                        "lo": [round(float(x), 5) for x in lo], "hi": [round(float(x), 5) for x in hi]})
    # Tests
    ev["z_react"] = ev["react"] / (ev["sd"] * np.sqrt(5))
    ev["z_drift"] = ev["drift"] / (ev["sd"] * np.sqrt(57))
    def tests(sub, col, zcol):
        n = len(sub)
        patell = sub[zcol].sum() / np.sqrt(n) if n else np.nan
        bmp = sub[zcol].mean() / (sub[zcol].std() / np.sqrt(n)) if n > 2 else np.nan
        return {"n": n, "mean": float(sub[col].mean()), "patell_z": float(patell), "bmp_t": float(bmp),
                "p_bmp": float(2 * (1 - stats.t.cdf(abs(bmp), n - 1))) if n > 2 else np.nan}
    hi_q, lo_q = ev[ev.q == 4], ev[ev.q == 0]
    spread = hi_q["drift"].mean() - lo_q["drift"].mean()
    bs = []
    for _ in range(1000):
        a = rng.choice(hi_q["drift"].values, len(hi_q)); c = rng.choice(lo_q["drift"].values, len(lo_q))
        bs.append(a.mean() - c.mean())
    regimes = {}
    for reg, sub in ev.groupby("regime"):
        h, l = sub[sub.q == 4], sub[sub.q == 0]
        regimes[reg] = {"n": int(len(sub)), "react_spread": float(h["react"].mean() - l["react"].mean()) if len(h) and len(l) else None,
                        "drift_spread": float(h["drift"].mean() - l["drift"].mean()) if len(h) and len(l) else None,
                        "slope_react": float(np.polyfit(sub["surprise"], sub["react"], 1)[0]) if len(sub) > 5 else None}
    return {
        "metric": metric, "n": int(len(ev)), "status": "ok", "days": days, "buckets": buckets,
        "reaction": {"top": tests(hi_q, "react", "z_react"), "bottom": tests(lo_q, "react", "z_react")},
        "drift": {"top": tests(hi_q, "drift", "z_drift"), "bottom": tests(lo_q, "drift", "z_drift"),
                  "spread": float(spread), "spread_ci90": [float(np.percentile(bs, 5)), float(np.percentile(bs, 95))],
                  "t": float(spread / np.std(bs)) if np.std(bs) else None},
        "regimes": regimes,
        "events": [{"ticker": r.ticker, "period": r.period, "date": r.date.date().isoformat(),
                    "surprise": round(float(r.surprise), 3), "react": round(r.react, 4), "drift": round(r.drift, 4)}
                   for r in ev.itertuples()],
    }


# ------------------------------------------------------------ earnings vs re-rating

def ltm_eps_daily(wh, t: str) -> pd.Series:
    q = wh.quarterly[wh.quarterly.ticker == t].sort_values("quarter_end").reset_index(drop=True)
    q["ltm"] = q["eps"].rolling(4, min_periods=4).sum()
    s = pd.Series(q["ltm"].values, index=pd.DatetimeIndex(q["known_at"])).dropna()
    s = s[~s.index.duplicated(keep="last")].sort_index()
    px = wh.prices[t].dropna()
    return s.reindex(px.index.union(s.index)).ffill().reindex(px.index)


def earnings_vs_rerating(wh) -> dict:
    out = {}
    for t in C.UNIVERSE:
        if t not in wh.prices:
            continue
        px = wh.prices[t].dropna()
        eps = ltm_eps_daily(wh, t)
        pe = px / eps
        rows = {}
        end = px.index[-1]
        for yrs in (1, 3, 5):
            start = end - pd.DateOffset(years=yrs)
            i0 = px.index.searchsorted(start)
            if i0 >= len(px) or pd.isna(eps.iloc[i0]) or eps.iloc[i0] <= 0 or eps.iloc[-1] <= 0:
                rows[f"{yrs}y"] = None
                continue
            tot = float(np.log(px.iloc[-1] / px.iloc[i0]))
            e = float(np.log(eps.iloc[-1] / eps.iloc[i0]))
            rows[f"{yrs}y"] = {"total": tot, "earnings": e, "rerating": tot - e,
                               "pe_start": float(pe.iloc[i0]), "pe_end": float(pe.iloc[-1])}
        hist = pe[pe > 0].resample("ME").last().dropna()
        out[t] = {"windows": rows, "pe_now": float(pe.iloc[-1]) if pd.notna(pe.iloc[-1]) else None,
                  "pe_history": [{"d": d.date().isoformat(), "pe": round(float(v), 2)} for d, v in hist.items()],
                  "eps_ltm": float(eps.iloc[-1]) if pd.notna(eps.iloc[-1]) else None}
    return out
