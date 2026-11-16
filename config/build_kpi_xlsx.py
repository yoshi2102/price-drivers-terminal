"""Write the sector KPI framework (config/sectors/*.json) to one formatted Excel workbook."""
import glob, json, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SRC, OUT = sys.argv[1], sys.argv[2]
ORDER = ["Autos", "Materials", "Industrials", "Consumer", "Financials", "Healthcare",
         "Tech & Internet", "Energy & Utilities", "Real assets", "Services"]
secs = [json.load(open(f)) for f in glob.glob(SRC + "/*.json")]
secs.sort(key=lambda s: (ORDER.index(s["group"]), s["name"]))

HEAD = PatternFill("solid", fgColor="1F4FD1")
CORE = PatternFill("solid", fgColor="E8EEFC")
BAND = PatternFill("solid", fgColor="F1EFE8")
thin = Side(style="thin", color="D9D5CB")
BOX = Border(top=thin, bottom=thin, left=thin, right=thin)
WRAP = Alignment(wrap_text=True, vertical="top")
FONT = "Aptos"


def sheet(ws, headers, widths, rows, core_col=None, sector_col=1):
    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(1, c)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
        cell.fill = HEAD
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = BOX
        ws.column_dimensions[get_column_letter(c)].width = widths[c - 1]
    ws.row_dimensions[1].height = 30
    prev, band = None, False
    for r in rows:
        ws.append(r)
        i = ws.max_row
        if r[sector_col] != prev:
            band, prev = not band, r[sector_col]
        is_core = core_col is not None and r[core_col] == "Core"
        for c in range(1, len(headers) + 1):
            cell = ws.cell(i, c)
            cell.alignment = WRAP
            cell.border = BOX
            cell.font = Font(name=FONT, size=9.5, bold=(c in (sector_col + 1, sector_col + 2) and is_core))
            if is_core:
                cell.fill = CORE
            elif band:
                cell.fill = BAND
    ws.freeze_panes = "D2"
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.zoomScale = 110


wb = Workbook()

# 1. All KPIs
ws = wb.active
ws.title = "All KPIs"
rows = []
for s in secs:
    ks = sorted(s["kpis"], key=lambda k: k.get("priority") != "core")
    for k in ks:
        rows.append([s["group"], s["name"], k["name"], "Core" if k.get("priority") == "core" else "Secondary",
                     k.get("definition"), k.get("formula"), k.get("unit"), k.get("frequency"),
                     k.get("why_it_moves_price"), k.get("history_source"), k.get("estimate_source"),
                     k.get("traps"), ", ".join(k.get("examples") or [])])
sheet(ws, ["Group", "Sector", "KPI", "Priority", "What it is", "How to calculate", "Unit", "Frequency",
           "Why it moves the share price", "History: where in Airavat", "Forward estimates: where from",
           "Traps", "Example stocks"],
      [14, 20, 32, 10, 42, 30, 12, 11, 55, 42, 42, 42, 20], rows, core_col=3)

# 2. Sector summary
ws2 = wb.create_sheet("Sector summary")
rows = []
for s in secs:
    drivers = "\n".join(f"{d.get('sign')} {d['driver']}: {d.get('why')}" for d in s["price_drivers"])
    core = "\n".join("• " + k["name"] for k in s["kpis"] if k.get("priority") == "core")
    subs = ", ".join(x if isinstance(x, str) else x.get("name", "") for x in s.get("subsectors") or [])
    rows.append([s["group"], s["name"], subs, s.get("unit_economics"), drivers, core, s.get("valuation_anchor")])
sheet(ws2, ["Group", "Sector", "Sub-sectors", "How profit is built", "What moves the share price (+ helps, − hurts)",
            "Core KPIs", "Valuation anchor"], [14, 20, 30, 50, 75, 38, 45], rows)

# 3. MOFSL 2QFY27
ws3 = wb.create_sheet("MOFSL 2QFY27")
rows = []
for s in secs:
    m = s.get("mofsl_2qfy27") or {}
    rows.append([s["group"], s["name"], ", ".join(map(str, m.get("pages") or [])), m.get("headline"), m.get("read"),
                 ", ".join(m.get("surprises") or []) or "None named", ", ".join(m.get("misses") or []) or "None named",
                 s.get("watch_next_quarter")])
sheet(ws3, ["Group", "Sector", "Pages", "Headline", "The quarter", "Beats", "Misses", "Watch in 3QFY27"],
      [14, 20, 8, 40, 75, 22, 22, 55], rows)

# 4. Macro inputs
ws4 = wb.create_sheet("Macro inputs")
rows = [[s["group"], s["name"], x.get("series"), x.get("why"), x.get("source")]
        for s in secs for x in s.get("macro_inputs") or []]
sheet(ws4, ["Group", "Sector", "Series", "Why it matters", "Source"], [14, 20, 35, 60, 50], rows)

wb.save(OUT)
print(OUT, sum(len(s["kpis"]) for s in secs), "KPIs")
