"""Ingest raw Airavat pulls into tidy, point-in-time tables.

Every fundamental row carries `period` (what it describes) and `known_at`
(first date the market could know it). `pit()` is the only sanctioned way
for a model to read fundamentals: it drops anything known after `as_of`.
"""
from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C


def quarter_end(period: str) -> date:
    """FY27Q2 -> 2026-09-30 (Indian fiscal year)."""
    fy = 2000 + int(period[2:4])
    q = int(period[-1])
    y, m = {1: (fy - 1, 6), 2: (fy - 1, 9), 3: (fy - 1, 12), 4: (fy, 3)}[q]
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return nxt - timedelta(days=1)


def period_from_fy_q(fy: int, q: int) -> str:
    return f"FY{fy % 100:02d}Q{q}"


def prev_period(period: str, n: int = 1) -> str:
    fy, q = 2000 + int(period[2:4]), int(period[-1])
    idx = fy * 4 + (q - 1) - n
    return period_from_fy_q(idx // 4, idx % 4 + 1)


@dataclass
class Warehouse:
    security: pd.DataFrame
    prices: pd.DataFrame          # wide: date x ticker, close
    fundamentals: pd.DataFrame    # long, point-in-time
    quarterly: pd.DataFrame       # one row per ticker x period with known_at
    kpi: pd.DataFrame
    consensus: dict               # ticker -> raw consensus json
    consensus_hist: pd.DataFrame  # long revision history
    commodities: dict             # slug -> pd.Series
    events: pd.DataFrame          # ticker, period, results_date, date_source
    brokers: pd.DataFrame
    source_notes: list = field(default_factory=list)

    def pit(self, as_of: str | pd.Timestamp) -> pd.DataFrame:
        as_of = pd.Timestamp(as_of)
        return self.quarterly[self.quarterly["known_at"] <= as_of]


# ---------------------------------------------------------------- prices

def load_prices() -> tuple[pd.DataFrame, list[dict]]:
    frames, meta = {}, []
    for f in sorted((C.RAW_DIR / "prices").glob("*.json")):
        d = json.loads(f.read_text())
        s = pd.Series({pd.Timestamp(a): float(b) for a, b in d["prices"]}, name=d["nse_code"])
        frames[d["nse_code"]] = s
        meta.append({"ticker": d["nse_code"], "first": d["first"]["date"], "last": d["last"]["date"],
                     "n": d["trading_days"]})
    px = pd.DataFrame(frames).sort_index()
    return px, meta


# ---------------------------------------------------------------- financials

def _ace_rows(t: str, d: dict) -> list[dict]:
    rows = []
    data = d["data"]
    basis = "consolidated" if data.get("consolidated", {}).get("QPNL") else "standalone"
    q = data[basis]["QPNL"]
    for period, r in q.items():
        if not period.startswith("FY") or "Q" not in period:
            continue

        def g(*keys):
            for k in keys:
                try:
                    v = float(r.get(k))
                except (TypeError, ValueError):
                    continue
                if np.isfinite(v) and (v != 0 or k == keys[-1]):
                    return v
            return None

        rev = g("Net_Sales")
        ebitda = g("pbidtxoi")
        pat = g("NetProfit_OwnOfParent", "Net_Profit", "Pat")
        eps = g("eps_basic", "EPSAbs")
        rows.append({"ticker": t, "basis": basis, "period": period,
                     "revenue_cr": rev / 10 if rev is not None else np.nan,
                     "ebitda_cr": ebitda / 10 if ebitda is not None else np.nan,
                     "pat_cr": pat / 10 if pat is not None else np.nan,
                     "eps": float(eps) if eps is not None else np.nan,
                     "power_fuel_cr": (g("Electricity_Power_Fuel") or np.nan) / 10,
                     "freight_cr": (g("Selling_Dist_Expenses") or np.nan) / 10,
                     "source_tag": f"[AIRAVAT:get_financials ACE {basis} QPNL {period}]"})
    # Annual EPS for quarter-sum checks
    return rows


def _api_rows(t: str, d: dict) -> list[dict]:
    rows = []
    c = d["data"]["consolidated"]["by_data_class"]["QPNL"]
    for period in c.get("periods", []):
        r = c[period]
        rev = r.get("pnl:revenue")
        tot = r.get("pnl:total_expenses")
        fin = r.get("pnl:finance_costs") or 0
        dep = r.get("pnl:depreciation_amortisation") or 0
        ebitda = (rev - (tot - fin - dep)) if (rev is not None and tot is not None) else None
        pat = r.get("pnl:profit_attributable_to_owners") or r.get("pnl:profit_after_tax")
        rows.append({"ticker": t, "basis": "consolidated", "period": period,
                     "revenue_cr": rev / 1e7 if rev is not None else np.nan,
                     "ebitda_cr": ebitda / 1e7 if ebitda is not None else np.nan,
                     "pat_cr": pat / 1e7 if pat is not None else np.nan,
                     "eps": r.get("pnl:eps_basic", np.nan),
                     "power_fuel_cr": (r.get("pnl:power_and_fuel") or np.nan) / 1e7,
                     "freight_cr": (r.get("pnl:freight_forwarding_expense") or np.nan) / 1e7,
                     "source_tag": f"[AIRAVAT:get_financials consolidated QPNL {period}]"})
    return rows


def _annual_eps(t: str, d: dict) -> dict:
    out = {}
    if "status" in d:  # Financials API
        c = d["data"]["consolidated"]["by_data_class"].get("PNL", {})
        for p in c.get("periods", []):
            out[p] = {"eps": c[p].get("pnl:eps_basic"),
                      "revenue_cr": (c[p].get("pnl:revenue") or np.nan) / 1e7,
                      "pat_cr": (c[p].get("pnl:profit_attributable_to_owners") or np.nan) / 1e7}
    else:
        data = d["data"]
        basis = "consolidated" if data.get("consolidated", {}).get("PNL") else "standalone"
        for p, r in data[basis].get("PNL", {}).items():
            if not p.startswith("FY"):
                continue
            unit = r.get("Unit") or 1
            def sc(v):
                return v * unit / 1e7 if v not in (None, "") else np.nan
            out[p] = {"eps": r.get("eps_basic") or r.get("EPSAbs") or r.get("Adj_eps_abs"),
                      "revenue_cr": sc(r.get("Net_Sales")),
                      "pat_cr": sc(r.get("NetProfit_OwnOfParent") or r.get("Net_Profit"))}
    return out


def load_fundamentals(events: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    rows, annual = [], {}
    for t in C.CEMENT:
        f = C.RAW_DIR / "financials" / f"{t}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        rows += _api_rows(t, d) if "status" in d else _ace_rows(t, d)
        annual[t] = _annual_eps(t, d)
    q = pd.DataFrame(rows)
    q["origin"] = "financials_api"
    hist = load_history()
    if len(hist):
        have = set(zip(q.ticker, q.period))
        hist = hist[[(t, p) not in have for t, p in zip(hist.ticker, hist.period)]]
        q = pd.concat([q, hist.assign(origin="broker_or_filing_history")], ignore_index=True)
    q["quarter_end"] = pd.to_datetime(q["period"].map(quarter_end))
    ev = events.set_index(["ticker", "period"])["results_date"] if len(events) else pd.Series(dtype="datetime64[ns]")

    def known(r):
        key = (r.ticker, r.period)
        if key in ev.index and pd.notna(ev.loc[key]):
            return pd.Timestamp(ev.loc[key]), "results_date"
        lag = C.FALLBACK_LAG_DAYS[r.period[-2:]]
        return r.quarter_end + pd.Timedelta(days=lag), "fallback_lag"

    kn = q.apply(known, axis=1, result_type="expand")
    q["known_at"], q["known_at_source"] = kn[0], kn[1]
    q = q.sort_values(["ticker", "quarter_end"]).reset_index(drop=True)

    long = q.melt(id_vars=["ticker", "basis", "period", "known_at", "source_tag"],
                  value_vars=["revenue_cr", "ebitda_cr", "pat_cr", "eps"],
                  var_name="field", value_name="value")
    long["data_class"] = "QPNL"
    return long, q, annual


def load_history() -> pd.DataFrame:
    """Pre-FY21 quarters extracted from broker results tables and filings (Rs crore)."""
    frames = [pd.read_csv(f) for f in sorted((C.RAW_DIR / "financials_hist").glob("*.csv"))]
    if not frames:
        return pd.DataFrame()
    h = pd.concat(frames, ignore_index=True)
    h = h[h.period.astype(str).str.match(r"^FY\d{2}Q[1-4]$")]
    for c in ["revenue_cr", "ebitda_cr", "pat_cr", "eps"]:
        h[c] = pd.to_numeric(h.get(c), errors="coerce")
    h["basis"] = h.get("basis", "consolidated").fillna("consolidated")
    # Consolidated wins where a quarter has both bases.
    h["_b"] = (~h["basis"].str.lower().str.startswith("consol")).astype(int)
    h = h.dropna(subset=["revenue_cr"]).sort_values(["ticker", "period", "_b"], kind="stable").drop_duplicates(["ticker", "period"], keep="first")
    h["power_fuel_cr"], h["freight_cr"] = np.nan, np.nan
    return h[["ticker", "basis", "period", "revenue_cr", "ebitda_cr", "pat_cr", "eps", "power_fuel_cr", "freight_cr", "source_tag"]]


def load_expectations() -> pd.DataFrame:
    """Pre-results street expectations per company-quarter (previews, consensus)."""
    f = C.RAW_DIR / "consensus_hist" / "quarter_expectations.csv"
    if not f.exists():
        return pd.DataFrame()
    e = pd.read_csv(f)
    e["source_date"] = pd.to_datetime(e["source_date"], errors="coerce")
    for c in ["revenue_cr", "ebitda_cr", "pat_cr", "volume_mt", "ebitda_per_t"]:
        e[c] = pd.to_numeric(e.get(c), errors="coerce")
    return e


# ---------------------------------------------------------------- kpi / events

def load_events() -> pd.DataFrame:
    frames = [pd.read_csv(f) for f in sorted((C.RAW_DIR / "events").glob("results_dates*.csv"))]
    for f in sorted((C.RAW_DIR / "financials_hist").glob("*.csv")):
        h = pd.read_csv(f)
        if "results_date" in h:
            h = h.dropna(subset=["results_date"])[["ticker", "period", "results_date", "source_tag"]]
            frames.append(h)
    if not frames:
        return pd.DataFrame(columns=["ticker", "period", "results_date", "source_tag"])
    df = pd.concat(frames, ignore_index=True)
    df["results_date"] = pd.to_datetime(df["results_date"], errors="coerce")
    df = df.dropna(subset=["results_date"])
    tag = df["source_tag"].fillna("")
    df["date_quality"] = np.select([tag.str.contains("CALLDATE"), tag.str.contains("PRESDATE")], ["call_date", "presentation_date"], "board_date")
    # Shree Cement holds its call 4-6 days after results: a call date would put
    # the reaction window after the reaction, so those rows are excluded.
    df = df[~((df.ticker == "SHREECEM") & (df.date_quality == "call_date"))]
    # Board/results dates beat call dates; among equals keep the first file read.
    df["_rank"] = df.date_quality.map({"board_date": 0, "presentation_date": 1, "call_date": 2})
    df = df.sort_values(["ticker", "period", "_rank"], kind="stable").drop(columns="_rank")
    return df.drop_duplicates(["ticker", "period"], keep="first")


def load_kpi() -> pd.DataFrame:
    files = sorted((C.RAW_DIR / "kpi").glob("cement_volumes*.csv"), key=lambda f: (f.name != "cement_volumes.csv", f.name))
    frames = [pd.read_csv(f) for f in files]
    for f in sorted((C.RAW_DIR / "financials_hist").glob("*.csv")):
        h = pd.read_csv(f)
        if "volume_mt" in h:
            h = h.dropna(subset=["volume_mt"]).rename(columns={"volume_mt": "sales_volume_mt"})
            h["known_at"] = h.get("results_date")
            frames.append(h[["ticker", "period", "sales_volume_mt", "source_tag", "known_at"]])
    if not frames:
        return pd.DataFrame(columns=["ticker", "period", "kpi_code", "value", "unit", "known_at", "source_tag"])
    df = pd.concat(frames, ignore_index=True)
    df = df.rename(columns={"sales_volume_mt": "value"})
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["value"])
    df["kpi_code"], df["unit"] = "sales_volume", "mt"
    df["known_at"] = pd.to_datetime(df.get("known_at"), errors="coerce")
    return df.drop_duplicates(["ticker", "period"], keep="first")


def load_consensus() -> tuple[dict, pd.DataFrame]:
    raw, hist = {}, []
    for t in C.CEMENT:
        f = C.RAW_DIR / "consensus" / f"{t}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        raw[t] = d
        for fy, block in (d.get("consensus_revisions", {}).get("annual") or {}).items():
            for row in block.get("history", []):
                hist.append({"ticker": t, "fiscal_year": fy, "snapshot_date": pd.Timestamp(row[0]),
                             "sales": row[1], "ebitda": row[2], "pat": row[3], "eps": row[4]})
    return raw, pd.DataFrame(hist)


def load_commodities() -> dict:
    out = {}
    for f in sorted((C.RAW_DIR / "commodities").glob("*.json")):
        d = json.loads(f.read_text())
        s = pd.Series({pd.Timestamp(a): float(b) for a, b in d["values"] if b is not None}).sort_index()
        s.name = d.get("commodity", f.stem)
        out[f.stem] = s
    return out


def load_brokers() -> pd.DataFrame:
    frames = []
    for f in sorted((C.RAW_DIR / "brokers").glob("*_broker_estimates*.csv")):
        frames.append(pd.read_csv(f))
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    df["note_date"] = pd.to_datetime(df["note_date"], errors="coerce")
    df = df.drop_duplicates(["note_id", "fy"], keep="first")
    for c in ["target_price", "cmp_stated", "eps", "ebitda_cr", "revenue_cr", "extraction_confidence"]:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.dropna(subset=["note_date"])


def build() -> Warehouse:
    px, _ = load_prices()
    events = load_events()
    fund_long, quarterly, annual = load_fundamentals(events)
    kpi = load_kpi()
    if len(kpi):
        quarterly = quarterly.merge(kpi[["ticker", "period", "value", "known_at", "source_tag"]]
                                    .rename(columns={"value": "volume_mt", "known_at": "kpi_known_at",
                                                     "source_tag": "kpi_source"}),
                                    on=["ticker", "period"], how="left")
        # KPI is usable no earlier than the financials of the same quarter.
        quarterly["kpi_known_at"] = quarterly[["kpi_known_at", "known_at"]].max(axis=1)
    else:
        quarterly["volume_mt"] = np.nan
        quarterly["kpi_known_at"] = quarterly["known_at"]
        quarterly["kpi_source"] = None
    cons, cons_hist = load_consensus()
    sec = pd.DataFrame([{"security_id": t, "nse_code": t, "name": n, "sector": "Cement",
                         "sub_sector": "Cement", "listing_date": px[t].first_valid_index().date().isoformat()
                         if t in px else None} for t, n in C.CEMENT.items()])
    wh = Warehouse(security=sec, prices=px, fundamentals=fund_long, quarterly=quarterly, kpi=kpi,
                   consensus=cons, consensus_hist=cons_hist, commodities=load_commodities(),
                   events=events, brokers=load_brokers())
    wh.annual = annual  # type: ignore[attr-defined]
    wh.expectations = load_expectations()  # type: ignore[attr-defined]
    return wh
