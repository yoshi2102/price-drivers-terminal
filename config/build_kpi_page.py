import json, glob, html, sys
from collections import OrderedDict

SRC = sys.argv[1]; OUT = sys.argv[2]
ORDER = ["Autos","Materials","Industrials","Consumer","Financials","Healthcare","Tech & Internet","Energy & Utilities","Real assets","Services"]
secs = [json.load(open(f)) for f in glob.glob(SRC + "/*.json")]
secs.sort(key=lambda s: (ORDER.index(s["group"]), s["name"]))
groups = OrderedDict((g, [s for s in secs if s["group"] == g]) for g in ORDER)
groups = OrderedDict((g, v) for g, v in groups.items() if v)
e = lambda x: html.escape(str(x if x is not None else ""))
nk = sum(len(s["kpis"]) for s in secs)
LIVE = {"cement": "/sector/cement", "technology": "/sector/it-services"}

def tick(lst):
    return ", ".join(e(x) for x in lst) if lst else "<span class='mute'>none named</span>"

def sub_names(s):
    out = []
    for x in s.get("subsectors") or []:
        out.append(x if isinstance(x, str) else x.get("name", ""))
    return ", ".join(e(x) for x in out)

def kpi_rows(kpis):
    r = []
    for k in kpis:
        ex = ", ".join(e(x) for x in (k.get("examples") or []))
        r.append(f"""<tr><td class='kn'><b>{e(k['name'])}</b><div class='meta'>{e(k.get('unit'))} · {e(k.get('frequency'))}</div>
<div class='fx'>{e(k.get('formula'))}</div></td>
<td>{e(k.get('why_it_moves_price'))}<div class='def'>{e(k.get('definition'))}</div></td>
<td>{e(k.get('history_source'))}</td><td>{e(k.get('estimate_source'))}</td>
<td class='trap'>{e(k.get('traps'))}</td><td class='mono small'>{ex}</td></tr>""")
    return "".join(r)

def kpi_table(kpis, title):
    if not kpis: return ""
    return f"""<h4>{title}</h4><div class='tw'><table class='kt'><thead><tr><th>KPI</th><th>Why the price cares</th>
<th>History (Airavat)</th><th>Forward estimates</th><th>Traps</th><th>Examples</th></tr></thead><tbody>{kpi_rows(kpis)}</tbody></table></div>"""

def sector(s):
    core = [k for k in s["kpis"] if k.get("priority") == "core"]
    sec = [k for k in s["kpis"] if k.get("priority") != "core"]
    m = s.get("mofsl_2qfy27") or {}
    pd = "".join(f"<li><span class='sg {'pos' if d.get('sign')=='+' else 'neg' if d.get('sign') in ('-','−') else 'mix'}'>{e(d.get('sign'))}</span><div><b>{e(d['driver'])}.</b> {e(d.get('why'))}</div></li>" for d in s["price_drivers"])
    mac = "".join(f"<tr><td><b>{e(x.get('series'))}</b></td><td>{e(x.get('why'))}</td><td class='mute'>{e(x.get('source'))}</td></tr>" for x in s.get("macro_inputs") or [])
    live = f"<span class='live'>Live model in terminal: {LIVE[s['code']]}</span>" if s["code"] in LIVE else ""
    pages = ", ".join(str(p) for p in m.get("pages") or [])
    return f"""<details class='sec' id='{e(s['code'])}'><summary><span class='sn'>{e(s['name'])}</span>
<span class='chips'>{''.join(f"<span class='chip'>{e(k['name'])}</span>" for k in core)}</span></summary>
<div class='body'><p class='subs'>Covers {sub_names(s)} {live}</p>
<div class='two'><div><h4>How profit is built</h4><pre class='ue'>{e(s.get('unit_economics'))}</pre>
<h4>What moves the share price</h4><ul class='pd'>{pd}</ul>
<p class='va'><b>Valuation anchor.</b> {e(s.get('valuation_anchor'))}</p></div>
<div class='mof'><h4>MOFSL 2QFY27 <span class='mute'>p. {pages}</span></h4><p class='hl'>{e(m.get('headline'))}</p><p>{e(m.get('read'))}</p>
<p class='bm'><span class='pos'>Beats:</span> {tick(m.get('surprises'))}<br><span class='neg'>Misses:</span> {tick(m.get('misses'))}</p>
<p class='watch'><b>Watch in 3QFY27.</b> {e(s.get('watch_next_quarter'))}</p></div></div>
{kpi_table(core,'Core KPIs')}{kpi_table(sec,'Secondary KPIs')}
{f"<h4>Macro inputs</h4><div class='tw'><table class='mt'><tbody>{mac}</tbody></table></div>" if mac else ""}
</div></details>"""

matrix = []
for g, ss in groups.items():
    matrix.append(f"<tr class='gr'><td colspan='3'>{e(g)}</td></tr>")
    for s in ss:
        top = s["price_drivers"][0]["driver"] if s["price_drivers"] else ""
        matrix.append(f"<tr><td><a href='#{e(s['code'])}' data-open='{e(s['code'])}'>{e(s['name'])}</a></td><td>{e(top)}</td><td>{' · '.join(e(k['name']) for k in s['kpis'] if k.get('priority')=='core')}</td></tr>")

nav = "".join(f"<div class='ng'><div class='nl'>{e(g)}</div>{''.join(f'<a href=\"#{e(s['code'])}\" data-open=\"{e(s['code'])}\">{e(s['name'])}</a>' for s in ss)}</div>" for g, ss in groups.items())
body = "".join(f"<section class='grp'><h2>{e(g)}</h2>{''.join(sector(s) for s in ss)}</section>" for g, ss in groups.items())

page = f"""<title>Sector KPI Library</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: sticky sector index on the left, one collapsible dossier per sector on the right; overview matrix up top */
:root{{--bg:#f6f4ef;--surface:#ffffff;--ink:#1b1d22;--mute:#5d616b;--line:#e2ded4;--accent:#1f4fd1;--accent-soft:#e8eefc;
--pos:#17794a;--neg:#b4362b;--warn:#8a5a00;--code:#f1efe8;
--display:"Newsreader",Georgia,serif;--ui:"Schibsted Grotesk",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#14161a;--surface:#1c1f25;--ink:#e8e6e1;--mute:#9a9ea8;--line:#2e323a;--accent:#8aa8ff;--accent-soft:#232c45;--pos:#5cc58f;--neg:#ff8a7d;--warn:#e0b45a;--code:#23262d;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#14161a;--surface:#1c1f25;--ink:#e8e6e1;--mute:#9a9ea8;--line:#2e323a;--accent:#8aa8ff;--accent-soft:#232c45;--pos:#5cc58f;--neg:#ff8a7d;--warn:#e0b45a;--code:#23262d;color-scheme:dark}}
body{{background:var(--bg);color:var(--ink);font:14px/1.55 var(--ui)}}
.wrap{{display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px;max-width:1500px;margin:0 auto;padding-block:32px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
nav{{position:sticky;top:calc(16px + env(safe-area-inset-top,0px));align-self:start;max-height:calc(100vh - 32px);overflow:auto;font-size:13px}}
nav .ng{{margin-bottom:14px}} nav .nl{{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin-bottom:4px}}
nav a{{display:block;color:var(--ink);text-decoration:none;padding:2px 0}} nav a:hover{{color:var(--accent)}}
main{{min-width:0}}
.eyebrow{{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}}
h1{{font:600 40px/1.1 var(--display);margin:4px 0 10px;text-wrap:balance}}
.lede{{max-width:72ch;color:var(--mute);margin:0 0 8px}}
.stats{{font:13px var(--mono);color:var(--mute);margin:0 0 28px}}
h2{{font:600 26px/1.2 var(--display);margin:40px 0 12px}}
h3{{font:600 20px var(--display);margin:0 0 10px}}
h4{{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:20px 0 8px;font-weight:600}}
.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--surface)}}
table{{border-collapse:collapse;width:100%;font-size:13px}}
th{{text-align:left;font-weight:600;color:var(--mute);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}}
td{{padding:9px 10px;border-top:1px solid var(--line);vertical-align:top}}
.matrix td:first-child{{white-space:nowrap}} .matrix a{{color:var(--accent);text-decoration:none;font-weight:600}}
.matrix tr.gr td{{background:var(--code);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);font-weight:600;padding:5px 10px}}
.sec{{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-bottom:10px}}
.sec>summary{{cursor:pointer;padding:14px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;list-style:none}}
.sec>summary::-webkit-details-marker{{display:none}}
.sec>summary::before{{content:"+";font:500 16px var(--mono);color:var(--accent);width:12px}}
.sec[open]>summary::before{{content:"−"}}
.sec>summary:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.sn{{font:600 19px var(--display);min-width:170px}}
.chips{{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}}
.chip{{font-size:12px;background:var(--accent-soft);color:var(--ink);padding:2px 8px;border-radius:3px}}
.body{{padding:0 16px 18px;border-top:1px solid var(--line)}}
.subs{{color:var(--mute);margin:12px 0 0}}
.live{{display:inline-block;margin-left:8px;font:12px var(--mono);color:var(--pos)}}
.two{{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px}}
pre.ue{{font:12.5px/1.6 var(--mono);background:var(--code);padding:12px;border-radius:4px;white-space:pre-wrap;margin:0}}
.pd{{list-style:none;padding:0;margin:0;display:grid;gap:10px}}
.pd li{{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px}}
.sg{{font:600 14px var(--mono)}} .pos{{color:var(--pos)}} .neg{{color:var(--neg)}} .mix{{color:var(--warn)}}
.va{{margin-top:14px}}
.mof .hl{{font-weight:600;margin:0 0 6px}} .mof p{{margin:0 0 10px}}
.bm{{font:12.5px var(--mono)}}
.watch{{border-left:3px solid var(--warn);padding:8px 12px;background:var(--code);border-radius:0 4px 4px 0}}
.kt{{min-width:1100px}} .kt td{{font-size:12.5px}}
.kn{{width:200px}} .meta{{font:11.5px var(--mono);color:var(--mute);margin-top:2px}}
.fx{{font:11.5px var(--mono);color:var(--mute);margin-top:6px}}
.def{{color:var(--mute);margin-top:6px;font-size:12px}}
.trap{{color:var(--warn)}} .mono{{font-family:var(--mono)}} .small{{font-size:11.5px}} .mute{{color:var(--mute)}}
.mt td{{font-size:12.5px}}
.toolbar{{display:flex;gap:8px;margin:0 0 12px}}
button{{font:500 12.5px var(--ui);background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:5px 10px;cursor:pointer}}
button:hover{{border-color:var(--accent)}} button:focus-visible{{outline:2px solid var(--accent)}}
@media (max-width:900px){{.wrap{{grid-template-columns:1fr}} nav{{display:none}} .two{{grid-template-columns:1fr;gap:0}} h1{{font-size:32px}}}}
</style>
<div class="wrap"><nav aria-label="Sectors">{nav}</nav><main>
<div class="eyebrow">Buoyant Capital · internal</div>
<h1>Sector KPI Library</h1>
<p class="lede">For each of MOFSL's 2QFY27 sectors: how profit is built, what moves the share price, and the KPIs specific to that sector. Each KPI names where its history sits in Airavat and where forward estimates come from, and flags when no consensus exists. Sector reads come from MOFSL's India Strategy review of 15 Nov 2026. The KPI method comes from Buoyant's sector skills.</p>
<p class="stats">{len(secs)} sectors · {nk} KPIs · {sum(1 for s in secs for k in s['kpis'] if k.get('priority')=='core')} core</p>
<h2>At a glance</h2>
<div class="tw"><table class="matrix"><thead><tr><th>Sector</th><th>Biggest price driver</th><th>Core KPIs</th></tr></thead><tbody>{''.join(matrix)}</tbody></table></div>
<h2>Sector dossiers</h2>
<div class="toolbar"><button id="openall" type="button">Expand all</button><button id="closeall" type="button">Collapse all</button></div>
{body}
</main></div>
<script>
const all=[...document.querySelectorAll('details.sec')];
document.getElementById('openall').onclick=()=>all.forEach(d=>d.open=true);
document.getElementById('closeall').onclick=()=>all.forEach(d=>d.open=false);
function openHash(){{const id=location.hash.slice(1);const d=id&&document.getElementById(id);if(d&&d.tagName==='DETAILS'){{d.open=true;d.scrollIntoView();}}}}
document.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click',()=>{{const d=document.getElementById(a.dataset.open);if(d)d.open=true;}}));
window.addEventListener('hashchange',openHash);openHash();
</script>
"""
open(OUT, "w").write(page)
print(OUT, len(page))
