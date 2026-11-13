"""Orchestrator: ingest -> validate -> model -> publish.

Usage: python -m pdt.run
Writes data/snapshots/<snapshot_id>/*.json, then moves the published pointer
only after every stage succeeds, so a failed run never shows half-updated data.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import attribution as A
from . import backtest, brokers, factors, forward, ingest, quality
from . import config as C

LOG: list[dict] = []


def stage(name):
    def deco(fn):
        def wrap(*a, **k):
            t0 = time.time()
            try:
                r = fn(*a, **k)
                LOG.append({"stage": name, "status": "ok", "seconds": round(time.time() - t0, 2)})
                return r
            except Exception as e:
                LOG.append({"stage": name, "status": "failed", "seconds": round(time.time() - t0, 2), "error": str(e)[:300]})
                raise
        return wrap
    return deco


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else round(float(o), 6)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, (pd.Timestamp,)):
        return o.date().isoformat()
    return o


def code_hash() -> str:
    h = hashlib.sha256()
    for f in sorted((C.ROOT / "worker" / "pdt").glob("*.py")):
        h.update(f.read_bytes())
    return h.hexdigest()[:12]


def raw_hash() -> str:
    h = hashlib.sha256()
    for f in sorted(C.RAW_DIR.rglob("*")):
        if f.is_file():
            h.update(f.name.encode()); h.update(f.read_bytes())
    return h.hexdigest()[:12]


def ret(px: pd.Series, days: int) -> float | None:
    px = px.dropna()
    if len(px) <= days:
        return None
    return float(px.iloc[-1] / px.iloc[-1 - days] - 1)


def main():
    t_start = time.time()
    wh = stage("ingest")(ingest.build)()
    fails, known_src = stage("validate")(quality.run)(wh)
    rets = factors.daily_returns(wh.prices)
    fac = stage("factor model")(factors.build_factors)(rets)
    fit_out = stage("factor betas (rolling, refit 21d)")(factors.fit)(rets, fac)
    panel = stage("driver panel")(A.build_panel)(wh, fit_out)

    def drivers():
        res = [A.test_driver(panel, c) for c in A.DRIVERS]
        return A.apply_gates(res)
    dres = stage("panel regressions + gates")(drivers)()
    disc = stage("elastic net + LightGBM/SHAP")(A.discovery)(panel, [c for c in A.DRIVERS if c != "prior_specific_3m"])
    seff = A.stock_effects(panel, dres)
    evr = stage("earnings vs re-rating")(A.earnings_vs_rerating)(wh)

    def events():
        out = {}
        n_real = int((panel.date_source == "results_date").sum())
        for m in ["street_ebitda_surprise", "street_revenue_surprise", "street_pat_surprise", "ebitda_sue", "revenue_sue", "pat_sue", "volume_surprise", "ebitda_margin_chg"]:
            real = A.event_study(panel, fit_out, m, require_dates=True)
            if real.get("status") == "ok":
                real["date_basis"] = "results_date"
                out[m] = real
            else:
                fb = A.event_study(panel, fit_out, m, require_dates=False)
                fb["date_basis"] = "mixed"
                fb["n_real_dates"] = int(real.get("n", 0))
                out[m] = fb
        return out, n_real
    ev, n_real = stage("event studies")(events)()
    bro = stage("broker accuracy")(brokers.run)(wh, fac)
    fwd, scen = stage("forward paths (Monte Carlo)")(forward.run)(wh, fit_out, fac, rets, panel)
    registry = build_registry(dres, disc)
    bt = stage("backtest lab")(backtest.run)(wh, fit_out, panel, dres, len(registry))

    snap_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = C.SNAPSHOT_DIR / snap_id
    (out / "stocks").mkdir(parents=True, exist_ok=True)
    (out / "scenarios").mkdir(exist_ok=True)

    asof = wh.prices.index.max().date().isoformat()
    mk = fac["market"].dropna()
    mk_px = np.exp(mk.cumsum())
    cement_px = np.exp(rets[[t for t in C.CEMENT if t in rets]].mean(axis=1).fillna(0).cumsum())

    # ---------------- sector page
    turning = []
    top3 = [r["code"] for r in sorted([r for r in dres if r.get("status") == "tested"], key=lambda r: r["p"])[:3]]
    for code in top3:
        s = panel.dropna(subset=[code]).sort_values("event_date")
        latest = s.groupby("ticker").tail(1)
        z = (latest[code] - s[code].mean()) / s[code].std()
        if (z.abs() > 1).mean() > 0.5:
            turning.append(code)
    share = {}
    for t, v in fit_out.items():
        share[t] = factors.share_explained(v["components"])
    sec_share = {k: float(np.mean([s.get(k, 0) for s in share.values()])) for k in ["market", "sector", "style", "specific"]}

    leaderboard = []
    for r in dres:
        if r.get("status") != "tested":
            leaderboard.append({"code": r["code"], "label": A.DRIVERS[r["code"]][0], "status": "insufficient",
                                "n_obs": r.get("n_obs"), "n_stocks": r.get("n_stocks"), "group": A.DRIVERS[r["code"]][3]})
            continue
        leaderboard.append({k: r[k] for k in ["code", "label", "group", "unit", "prior", "expected_sign", "effect_sd", "se",
                                              "ci90", "p", "q", "t", "sensitivity_per_unit", "incremental_r2",
                                              "oos_fold_share", "oos_mean_r2", "n_folds", "regimes", "rolling",
                                              "placebo_pct", "lead", "split", "n_obs", "n_stocks", "gates",
                                              "validated", "stability", "leads", "label_status", "regime_same_sign", "regime_n"]})
    leaderboard.sort(key=lambda r: (r.get("status") == "insufficient", -abs(r.get("t") or 0)))

    peer = []
    for t, name in C.CEMENT.items():
        eff = seff.get(t, {})
        tops = sorted(eff.items(), key=lambda kv: -abs(kv[1]["shrunk"] / max(kv[1]["se"], 1e-6) if kv[1]["se"] else 0))[:3]
        peer.append({"ticker": t, "name": name,
                     "top": [{"code": c, "label": A.DRIVERS[c][0], "shrunk": v["shrunk"], "raw": v["raw"], "se": v["se"],
                              "n": v["n"], "departs": v["departs"]} for c, v in tops],
                     "departs_any": any(v["departs"] for v in eff.values())})

    val_bands = {}
    for t, e in evr.items():
        h = pd.Series({pd.Timestamp(x["d"]): x["pe"] for x in e["pe_history"]})
        if len(h) < 24:
            continue
        b5, b10 = h.iloc[-60:], h.iloc[-120:]
        val_bands[t] = {"pe_now": e["pe_now"], "series": e["pe_history"][-120:],
                        "5y": {"mean": float(b5.median()), "sd": float((b5.quantile(.75) - b5.quantile(.25)) / 1.349), "p10": float(b5.quantile(.1)), "p90": float(b5.quantile(.9))},
                        "10y": {"mean": float(b10.median()), "sd": float(b10.std()), "n_months": int(len(b10))}}

    sector = {
        "sector": "Cement", "as_of": asof, "n_stocks": len(C.CEMENT), "share_explained": sec_share,
        "leaderboard": leaderboard, "decomposition": factors.quarterly_decomposition(fit_out),
        "earnings_vs_rerating": {t: e["windows"] for t, e in evr.items()}, "peer_table": peer,
        "regimes": [{"code": c, "label": l, "from": a, "to": b} for c, l, a, b in C.REGIMES],
        "valuation_bands": val_bands, "discovery": disc, "drivers_turning": turning,
        "panel_n": int(len(panel)), "panel_periods": [panel.period.min(), panel.period.max()],
        "date_basis": {"results_date": int((panel.date_source == "results_date").sum()),
                       "fallback_lag": int((panel.date_source == "fallback_lag").sum())},
        "factor_cov": factors.factor_cov(fac.assign(sector=rets[[t for t in C.CEMENT if t in rets]].mean(axis=1) - fac["market"])),
    }

    # ---------------- stocks
    index_rows = []
    for t, name in C.CEMENT.items():
        if t not in wh.prices:
            continue
        px = wh.prices[t].dropna()
        cons = wh.consensus.get(t, {})
        comps = fit_out[t]["components"]
        q = panel[panel.ticker == t].sort_values("tidx")
        lastq = wh.quarterly[wh.quarterly.ticker == t].sort_values("quarter_end").tail(4)
        shares = float((lastq["pat_cr"] * 1e7 / lastq["eps"]).replace([np.inf, -np.inf], np.nan).dropna().iloc[-1]) if len(lastq) else None
        mcap = px.iloc[-1] * shares / 1e7 if shares else None
        waterfall = {}
        evr_t = evr.get(t, {})
        eps_d = A.ltm_eps_daily(wh, t)
        for lbl, days in [("1m", 21), ("3m", 63), ("12m", 252)]:
            seg = comps.iloc[-days:].sum()
            e0, e1 = eps_d.iloc[-days - 1], eps_d.iloc[-1]
            E = float(np.log(e1 / e0)) if e0 and e1 and e0 > 0 and e1 > 0 else np.nan
            peerE = []
            for p in C.CEMENT:
                if p == t or p not in wh.prices:
                    continue
                ed = A.ltm_eps_daily(wh, p)
                if len(ed) > days and ed.iloc[-days - 1] and ed.iloc[-1] and ed.iloc[-days - 1] > 0 and ed.iloc[-1] > 0:
                    peerE.append(np.log(ed.iloc[-1] / ed.iloc[-days - 1]))
            spec_e = E - float(np.mean(peerE)) if np.isfinite(E) and peerE else None
            waterfall[lbl] = {"market": float(seg["market"]), "sector": float(seg["sector"]), "style": float(seg["style"]),
                              "specific": float(seg["specific"]), "total": float(seg["total"]),
                              "earnings_total": E if np.isfinite(E) else None,
                              "specific_earnings": spec_e,
                              "specific_rest": float(seg["specific"] - spec_e) if spec_e is not None else None}
        eff = seff.get(t, {})
        drv_panel = []
        for r in leaderboard:
            if r.get("status") == "insufficient" or r["code"] not in eff:
                continue
            e = eff[r["code"]]
            sub = q.dropna(subset=[r["code"]])
            latest = float(sub[r["code"]].iloc[-1]) if len(sub) else None
            avg4 = float(sub[r["code"]].iloc[-5:-1].mean()) if len(sub) > 4 else None
            sd = r["effect_sd"] and (r["sensitivity_per_unit"] / r["effect_sd"] if r["effect_sd"] else None)
            per_unit = e["shrunk"] * (r["sensitivity_per_unit"] / r["effect_sd"]) if r["effect_sd"] else None
            drv_panel.append({"code": r["code"], "label": r["label"], "unit": r["unit"], "effect_sd": e["shrunk"],
                              "per_unit": per_unit, "ci90": [e["shrunk"] - 1.645 * (e["weight"] * e["se"] ** 2 + (1 - e["weight"]) ** 2 * r["se"] ** 2) ** 0.5,
                                                             e["shrunk"] + 1.645 * (e["weight"] * e["se"] ** 2 + (1 - e["weight"]) ** 2 * r["se"] ** 2) ** 0.5],
                              "sector_effect_sd": r["effect_sd"], "weight_own": e["weight"], "n": e["n"],
                              "latest": latest, "latest_period": sub["period"].iloc[-1] if len(sub) else None,
                              "avg_prev4": avg4, "label_status": r["label_status"], "stability": r["stability"],
                              "leads": r["leads"], "departs": e["departs"], "incremental_r2": r["incremental_r2"]})
        drv_panel.sort(key=lambda d: -abs(d["effect_sd"] / max((d["ci90"][1] - d["ci90"][0]) / 3.29, 1e-6)))
        kcols = ["period", "event_date", "date_source", "revenue_yoy", "ebitda_yoy", "volume_growth", "realisation_yoy",
                 "cost_per_t_yoy", "ebitda_per_t", "ebitda_margin_chg", "revenue_sue", "ebitda_sue", "pat_sue",
                 "volume_surprise", "y_react", "y_drift", "y_window", "rev_cr", "ebitda_cr", "pat_cr", "volume_mt", "eps",
                 "realisation"]
        timeline = q[kcols].to_dict(orient="records")
        wk = px.resample("W-FRI").last().dropna()
        spec_cum = comps["specific"].cumsum().resample("W-FRI").last()
        mk_rel = (np.log(px) - np.log(mk_px.reindex(px.index).ffill())).resample("W-FRI").last()
        ann = cons.get("annual") or {}
        stock = {
            "ticker": t, "name": name, "sector": "Cement", "as_of": px.index[-1].date().isoformat(),
            "header": {"price": float(px.iloc[-1]), "r1d": ret(px, 1), "r1m": ret(px, 21), "r12m": ret(px, 252),
                       "mcap_cr": mcap, "bbg_dcf_price": (cons.get("bloomberg_dcf_price") or {}).get("price"),
                       "bbg_dcf_asof": (cons.get("bloomberg_dcf_price") or {}).get("as_of"),
                       "recs": (cons.get("bloomberg_recommendations") or {}).get("annual"),
                       "consensus_asof": (cons.get("bloomberg_updated") or {}).get("annual"),
                       "pe_now": evr_t.get("pe_now"), "eps_ltm": evr_t.get("eps_ltm")},
            "consensus": {"annual": {fy: v.get("bloomberg_consensus") for fy, v in ann.items()},
                          "revisions": {fy: v.get("change_pct") for fy, v in ((cons.get("consensus_revisions") or {}).get("annual") or {}).items()},
                          "history": {fy: v.get("history") for fy, v in ((cons.get("consensus_revisions") or {}).get("annual") or {}).items()},
                          "period_labels": cons.get("period_labels")},
            "betas": {k: float(v) for k, v in fit_out[t]["betas"].iloc[-1].items()},
            "share_explained": share.get(t), "waterfall": waterfall, "drivers": drv_panel, "timeline": timeline,
            "earnings_vs_rerating": evr_t.get("windows"), "pe_history": evr_t.get("pe_history"),
            "series": [{"d": d.date().isoformat(), "px": round(float(v), 2),
                        "spec": round(float(spec_cum.asof(d)), 5) if pd.notna(spec_cum.asof(d)) else None,
                        "rel": round(float(mk_rel.asof(d)), 5) if pd.notna(mk_rel.asof(d)) else None}
                       for d, v in wk.items()],
            "forward": fwd["stocks"].get(t),
            "brokers": (bro.get("tickers") or {}).get(t),
            "data_flags": [f for f in fails if f["ticker"] == t][:40],
        }
        (out / "stocks" / f"{t}.json").write_text(json.dumps(clean(stock)))
        if t in scen:
            (out / "scenarios" / f"{t}.json").write_text(json.dumps(clean(scen[t])))
        f12 = (fwd["stocks"].get(t) or {}).get("horizons", {}).get("12m", {})
        rv = ((cons.get("consensus_revisions") or {}).get("annual") or {})
        fy1 = sorted(rv)[0] if rv else None
        index_rows.append({"ticker": t, "name": name, "price": float(px.iloc[-1]), "r1m": ret(px, 21), "r3m": ret(px, 63),
                           "r12m": ret(px, 252), "mcap_cr": mcap, "pe": evr_t.get("pe_now"),
                           "fy1": fy1, "rev1m": ((rv.get(fy1) or {}).get("change_pct") or {}).get("1m", {}).get("EPS") if fy1 else None,
                           "rev3m": ((rv.get(fy1) or {}).get("change_pct") or {}).get("3m", {}).get("EPS") if fy1 else None,
                           "fwd_p50": (f12.get("pct") or {}).get("p50"), "fwd_p10": (f12.get("pct") or {}).get("p10"),
                           "fwd_p90": (f12.get("pct") or {}).get("p90"), "p_beat": f12.get("p_beat_market"),
                           "spec_20d": float(comps["specific"].iloc[-20:].sum()),
                           "spec_sd_20d": float(comps["specific"].iloc[-272:-20].std() * np.sqrt(20))})

    # ---------------- home
    alerts = []
    for r in index_rows:
        z = r["spec_20d"] / r["spec_sd_20d"] if r["spec_sd_20d"] else 0
        if abs(z) > 2:
            alerts.append({"ticker": r["ticker"], "kind": "Price outside expected band",
                           "detail": f"20-day stock-specific return {r['spec_20d']:+.1%} is {z:+.1f} SD from the model band", "z": z})
        if r["rev1m"] is not None and abs(r["rev1m"]) >= 5:
            alerts.append({"ticker": r["ticker"], "kind": "Consensus revision",
                           "detail": f"{r['fy1']} EPS consensus {r['rev1m']:+.1f}% in 1 month", "z": r["rev1m"] / 5})
    gap = [{"ticker": r["ticker"], "rev3m": r["rev3m"], "r3m": r["r3m"],
            "gap": (r["r3m"] * 100 - r["rev3m"]) if r["rev3m"] is not None and r["r3m"] is not None else None} for r in index_rows]
    comm_strip = []
    for k, s in wh.commodities.items():
        comm_strip.append({"key": k, "name": s.name, "last": float(s.iloc[-1]), "date": s.index[-1].date().isoformat(),
                           "chg_1m": float(s.iloc[-1] / s.asof(s.index[-1] - pd.Timedelta(days=30)) - 1),
                           "spark": [round(float(x), 2) for x in s.resample("W").last().dropna().iloc[-52:]]})
    home = {
        "as_of": asof,
        "sectors": [{"sector": "Cement", "status": "pilot", "n": len(C.CEMENT),
                     "r1m": ret(cement_px, 21), "r3m": ret(cement_px, 63), "r12m": ret(cement_px, 252),
                     "m1m": ret(mk_px, 21), "m3m": ret(mk_px, 63), "m12m": ret(mk_px, 252),
                     "share": sec_share, "turning": turning}] +
                   [{"sector": s, "status": "queued"} for s in C.ROLLOUT_SECTORS],
        "breadth": {"stocks": [{k: r[k] for k in ["ticker", "fy1", "rev1m", "rev3m"]} for r in index_rows]},
        "commodities": comm_strip, "alerts": sorted(alerts, key=lambda a: -abs(a["z"])), "revision_price_gap": gap,
        "market_proxy": {"constituents": C.MARKET_PROXY, "note": "Equal-weighted 16 large caps; Airavat has no index series."},
    }

    health = {
        "as_of": asof, "coverage": quality.coverage(wh), "failures": fails, "known_at_sources": known_src.to_dict(orient="records"),
        "log": LOG, "snapshot_id": snap_id,
        "raw_files": sorted(str(p.relative_to(C.RAW_DIR)) for p in C.RAW_DIR.rglob("*") if p.is_file()),
    }
    manifest = {"snapshot_id": snap_id, "created_at": datetime.now(timezone.utc).isoformat(), "as_of": asof,
                "code_hash": code_hash(), "data_hash": raw_hash(), "model_versions": {"attribution": "attr-1.0", "brokers": "brk-1.0",
                                                                                      "forward": "fp-1.0"},
                "params": {"factor_window": factors.WIN, "refit_days": factors.REFIT, "mc_paths": C.MC_PATHS, "seed": C.SEED,
                           "acceptance": C.ACCEPTANCE, "fallback_lag_days": C.FALLBACK_LAG_DAYS},
                "universe": C.CEMENT, "pilot_sector": "Cement", "runtime_seconds": round(time.time() - t_start, 1)}
    files = {"manifest.json": manifest, "home.json": home, "sector_cement.json": sector,
             "events.json": {"as_of": asof, "studies": ev, "n_real_dates": n_real},
             "brokers.json": bro, "forward.json": {k: v for k, v in fwd.items() if k != "stocks"} | {
                 "summary": {t: {"h": {hk: {"pct": h["pct"], "p_beat_market": h["p_beat_market"]} for hk, h in v["horizons"].items()},
                                 "price": v["price"]} for t, v in fwd["stocks"].items()}},
             "backtest.json": bt,
             "panel.json": {"columns": ["ticker", "period", "tidx", "event_date", "date_source", "regime", "y_react", "y_drift", "y_window"] + list(A.DRIVERS),
                            "labels": {k: v[0] for k, v in A.DRIVERS.items()}, "groups": {k: v[3] for k, v in A.DRIVERS.items()},
                            "rows": panel[["ticker", "period", "tidx", "event_date", "date_source", "regime", "y_react", "y_drift", "y_window"] + list(A.DRIVERS)]
                            .assign(event_date=lambda d: d.event_date.dt.date.astype(str)).round(5).values.tolist()}, "registry.json": registry, "health.json": health, "index.json": {"stocks": index_rows}}
    for name, obj in files.items():
        (out / name).write_text(json.dumps(clean(obj)))
    LOG.append({"stage": "publish", "status": "ok", "seconds": 0})
    health["log"] = LOG
    (out / "health.json").write_text(json.dumps(clean(health)))
    # file list lets the web build pull this snapshot from object storage
    (out / "files.json").write_text(json.dumps(sorted(str(f.relative_to(out)) for f in out.rglob("*.json"))))
    # move pointer + copy into the web app
    (C.SNAPSHOT_DIR / "PUBLISHED").write_text(snap_id)
    if C.WEB_DATA_DIR.exists():
        shutil.rmtree(C.WEB_DATA_DIR)
    shutil.copytree(out, C.WEB_DATA_DIR)
    print(json.dumps({"snapshot": snap_id, "seconds": round(time.time() - t_start, 1), "log": LOG}, indent=1))


def build_registry(dres, disc) -> list[dict]:
    rows = []
    created = datetime.now(timezone.utc).date().isoformat()
    for i, r in enumerate(dres):
        if r.get("status") != "tested":
            continue
        rows.append({"exp_id": f"EXP-{i+1:03d}", "hypothesis": f"{r['label']} explains post-results stock-specific return (cement)",
                     "analyst": "Sector skill prior (pre-registered)" if r["prior"] else "Discovery set",
                     "created_at": created, "n_tests": len([x for x in dres if x.get("status") == "tested"]),
                     "raw_p": r["p"], "adjusted_p": r["q"], "method": "Benjamini-Hochberg, FDR 10%",
                     "verdict": r["label_status"]})
    rows.append({"exp_id": f"EXP-{len(dres)+1:03d}", "hypothesis": "LightGBM beats elastic net out of sample by > 0.02 R²",
                 "analyst": "Discovery set", "created_at": created, "n_tests": 1, "raw_p": None, "adjusted_p": None,
                 "method": "Walk-forward purged folds", "verdict": "kept" if disc["gbm"]["kept"] else "rejected"})
    return rows


if __name__ == "__main__":
    main()
