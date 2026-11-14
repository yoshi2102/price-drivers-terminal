"""Static configuration for the pilot (cement) run.

Everything a model reads is listed here, so a run is reproducible from
(code hash, raw snapshot, this file).
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = Path(os.environ.get("PDT_RAW_DIR", "/home/user/pdt-raw"))
LAKE_DIR = ROOT / "data" / "lake"
SNAPSHOT_DIR = ROOT / "data" / "snapshots"
WEB_DATA_DIR = ROOT / "apps" / "web" / "data"

PILOT_SECTOR = "cement"

# Covered universe for the pilot sector. Names as printed on NSE.
CEMENT = {
    "ULTRACEMCO": "UltraTech Cement",
    "AMBUJACEM": "Ambuja Cements",
    "ACC": "ACC",
    "SHREECEM": "Shree Cement",
    "DALBHARAT": "Dalmia Bharat",
    "JKCEMENT": "JK Cement",
    "RAMCOCEM": "The Ramco Cements",
    "NUVOCO": "Nuvoco Vistas",
    "JKLAKSHMI": "JK Lakshmi Cement",
    "BIRLACORPN": "Birla Corporation",
    "HEIDELBERG": "Heidelberg Cement India",
    "STARCEMENT": "Star Cement",
}

IT_SERVICES = {
    "TCS": "Tata Consultancy Services",
    "INFY": "Infosys",
    "HCLTECH": "HCLTech",
    "WIPRO": "Wipro",
    "TECHM": "Tech Mahindra",
    "PERSISTENT": "Persistent Systems",
    "MPHASIS": "Mphasis",
    "LTTS": "L&T Technology Services",
    "TATAELXSI": "Tata Elxsi",
    "CYIENT": "Cyient",
    "ZENSARTECH": "Zensar Technologies",
    "BSOFT": "Birlasoft",
}
# LTIMindtree (LTM) and Coforge are left out: Airavat's price history for them
# is incomplete (LTM stops Feb 2026 with a merger jump; COFORGE starts Sep 2025).

SECTORS = {
    "cement": {"name": "Cement", "tickers": CEMENT,
               "priors": {"volume_growth", "realisation_yoy", "cost_per_t_yoy", "ebitda_per_t_yoy"}},
    "it-services": {"name": "IT services", "tickers": IT_SERVICES,
                    "priors": {"cc_growth_qoq", "tcv_growth_yoy", "ebit_margin_chg", "guidance_mid_chg"}},
}
ALL = {t: n for s in SECTORS.values() for t, n in s["tickers"].items()}
SECTOR_OF = {t: code for code, s in SECTORS.items() for t in s["tickers"]}

# Active sector for the per-sector engines (set by run.py).
SECTOR = "cement"
UNIVERSE = CEMENT
SECTOR_NAME = "Cement"


def set_sector(code: str) -> None:
    global SECTOR, UNIVERSE, SECTOR_NAME, PRIOR_DRIVERS
    SECTOR, UNIVERSE = code, SECTORS[code]["tickers"]
    SECTOR_NAME, PRIOR_DRIVERS = SECTORS[code]["name"], SECTORS[code]["priors"]


# Market proxy. Airavat holds no index series (checked: NIFTY 50 and
# NIFTYBEES both return "company not found"), so the market factor is an
# equal-weighted basket of 15 large caps across sectors until NSE index
# files are wired in.
MARKET_PROXY = [
    "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY", "TCS", "ITC", "LT",
    "HINDUNILVR", "KOTAKBANK", "SBIN", "BHARTIARTL", "MARUTI", "SUNPHARMA",
    "AXISBANK", "NTPC", "ASIANPAINT",
]

# Sectors queued for rollout after the pilot gate (shown on Home, no numbers).
ROLLOUT_SECTORS = [
    "Private banks", "Asset managers", "Paints",
    "Two-wheelers", "Electrical equipment", "Capital goods", "FMCG",
]

RISK_FREE_ANNUAL = 0.065  # flat proxy; 91-day T-bill series not yet connected

REGIMES = [
    ("pre_covid", "Pre-COVID", "2015-04-01", "2020-02-29"),
    ("covid", "COVID", "2020-03-01", "2021-12-31"),
    ("rate_hikes", "2022 rate hikes", "2022-01-01", "2022-12-31"),
    ("post_2023", "Post-2023", "2023-01-01", "2099-12-31"),
]

# Results are assumed public this many calendar days after quarter end when
# no announcement date is on file. Conservative (SEBI LODR allows 45 days,
# 60 for Q4), so the fallback can only delay information, never leak it.
FALLBACK_LAG_DAYS = {"Q1": 45, "Q2": 45, "Q3": 45, "Q4": 60}

# Priors pre-registered from the Buoyant cement sector skill:
# volume, realisation/t, cost/t, EBITDA/t, utilisation.
PRIOR_DRIVERS = {"volume_growth", "realisation_yoy", "cost_per_t_yoy", "ebitda_per_t_yoy"}

ACCEPTANCE = {
    "bh_q": 0.10,
    "oos_fold_share": 0.70,
    "regime_sign_share": 0.75,  # 3 of 4
    "placebo_pct": 95,
    "min_stocks": 8,
    "min_obs": 60,
}

MC_PATHS = 10_000
SEED = 20261113
