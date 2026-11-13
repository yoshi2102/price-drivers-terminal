"use client";
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart, CustomChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent,
  DataZoomComponent, VisualMapComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { Download, Table2, Pin } from "lucide-react";
import { pinToStudio } from "./studio-store";

echarts.use([BarChart, LineChart, ScatterChart, CustomChart, HeatmapChart, GridComponent, TooltipComponent,
  LegendComponent, MarkLineComponent, MarkAreaComponent, DataZoomComponent, VisualMapComponent, SVGRenderer]);

/* Colours inside options are written as "token:accent" or "token:accent/0.3"
   and resolved from CSS variables, so charts follow the light/dark theme. */
const FMT: Record<string, (v: any) => string> = {
  pct0: (v) => (v == null ? "—" : `${Number(v).toFixed(0)}%`),
  pct1: (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`),
  num1: (v) => (v == null ? "—" : Number(v).toFixed(1)),
  num2: (v) => (v == null ? "—" : Number(v).toFixed(2)),
  num3: (v) => (v == null ? "—" : Number(v).toFixed(3)),
  inr: (v) => (v == null ? "—" : `₹${Math.round(Number(v)).toLocaleString("en-IN")}`),
};
function resolve(o: any, css: CSSStyleDeclaration): any {
  /* Functions cannot cross the server/client boundary, so formatters are
     named: "fmt:pct1" becomes a function here. */
  if (typeof o === "string" && o.startsWith("fmt:")) return FMT[o.slice(4)] || ((v: any) => String(v));
  if (typeof o === "string" && o.startsWith("token:")) {
    const [name, a] = o.slice(6).split("/");
    const rgb = css.getPropertyValue(`--${name}`).trim().split(/\s+/).join(",");
    return a ? `rgba(${rgb},${a})` : `rgb(${rgb})`;
  }
  if (Array.isArray(o)) return o.map((x) => resolve(x, css));
  if (o && typeof o === "object" && !(o instanceof Function)) {
    const out: any = {};
    for (const k of Object.keys(o)) out[k] = resolve(o[k], css);
    return out;
  }
  return o;
}

function base(css: CSSStyleDeclaration) {
  const c = (n: string, a?: number) => { const v = css.getPropertyValue(`--${n}`).trim().split(/\s+/).join(","); return a ? `rgba(${v},${a})` : `rgb(${v})`; };
  return {
    animationDuration: 200,
    textStyle: { fontFamily: '"Schibsted Grotesk", ui-sans-serif', color: c("muted"), fontSize: 11 },
    grid: { left: 48, right: 16, top: 24, bottom: 28, containLabel: false },
    tooltip: {
      trigger: "axis", backgroundColor: c("surface"), borderColor: c("line"), borderWidth: 1,
      textStyle: { color: c("ink"), fontSize: 12, fontFamily: '"Schibsted Grotesk"' },
      extraCssText: "box-shadow: 0 6px 24px rgba(0,0,0,.12); border-radius: 6px;",
    },
    xAxis: { axisLine: { lineStyle: { color: c("line") } }, axisTick: { show: false }, axisLabel: { color: c("muted") }, splitLine: { show: false } },
    yAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: c("muted"), fontFamily: '"JetBrains Mono"' },
      splitLine: { lineStyle: { color: c("line", 0.6) } } },
  };
}

function merge(a: any, b: any): any {
  if (Array.isArray(b)) return b.map((x) => (a && !Array.isArray(a) && typeof a === "object" ? merge(a, x) : x));
  if (b && typeof b === "object") {
    const out: any = { ...(a || {}) };
    for (const k of Object.keys(b)) out[k] = a && typeof a[k] === "object" && !Array.isArray(a[k]) ? merge(a[k], b[k]) : b[k];
    return out;
  }
  return b;
}

export type TableData = { columns: string[]; rows: (string | number | null)[][] };

export default function Chart({
  option, height = 260, title, table, source, n, asOf, id,
}: {
  option: any; height?: number; title: string; table?: TableData; source?: string; n?: string | number; asOf?: string; id?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!el.current || showTable) return;
    const chart = echarts.init(el.current, undefined, { renderer: "svg" });
    inst.current = chart;
    const draw = () => {
      const css = getComputedStyle(document.documentElement);
      const b = base(css);
      const o = resolve(option, css);
      const full = { ...b, ...o, grid: { ...b.grid, ...(o.grid || {}) }, tooltip: { ...b.tooltip, ...(o.tooltip || {}) },
        xAxis: o.xAxis ? merge(b.xAxis, o.xAxis) : undefined, yAxis: o.yAxis ? merge(b.yAxis, o.yAxis) : undefined };
      chart.setOption(full, true);
    };
    draw();
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener("change", draw); chart.dispose(); };
  }, [option, showTable]);

  const fname = (title || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const save = (href: string, ext: string) => { const a = document.createElement("a"); a.href = href; a.download = `${fname}.${ext}`; a.click(); };
  const exportSvg = () => {
    const svg = (inst.current as any)?.renderToSVGString?.();
    if (svg) save(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), "svg");
  };
  const exportPng = () => {
    const svg = (inst.current as any)?.renderToSVGString?.();
    if (!svg || !el.current) return;
    const { width, height: h } = el.current.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = width * 2; c.height = h * 2;
      const ctx = c.getContext("2d")!; ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, c.width, c.height);
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0, width, h); save(c.toDataURL("image/png"), "png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  const exportCsv = () => {
    if (!table) return;
    const esc = (v: any) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [table.columns, ...table.rows].map((r) => r.map(esc).join(",")).join("\n");
    save(URL.createObjectURL(new Blob([csv], { type: "text/csv" })), "csv");
  };

  return (
    <figure className="relative" aria-label={title}>
      <div className="absolute right-0 -top-8 flex items-center gap-1 print:hidden">
        {table && (
          <button type="button" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}
            className="inline-flex h-7 items-center gap-1 rounded-chip px-2 text-2xs text-muted hover:bg-sunk hover:text-ink">
            <Table2 size={13} aria-hidden /> {showTable ? "Chart" : "Table"}
          </button>
        )}
        <button type="button" onClick={() => { pinToStudio({ id: id || fname, title, source, asOf }); setPinned(true); }}
          className="inline-flex h-7 items-center gap-1 rounded-chip px-2 text-2xs text-muted hover:bg-sunk hover:text-ink">
          <Pin size={13} aria-hidden /> {pinned ? "Pinned" : "Pin"}
        </button>
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu"
            className="inline-flex h-7 items-center gap-1 rounded-chip px-2 text-2xs text-muted hover:bg-sunk hover:text-ink">
            <Download size={13} aria-hidden /> Export
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-8 z-30 w-36 rounded-card border border-line bg-surface p-1 shadow-[0_6px_24px_rgba(0,0,0,.12)]"
              onMouseLeave={() => setMenu(false)}>
              {[["PNG image", exportPng, !showTable], ["Slide-ready SVG", exportSvg, !showTable], ["CSV data", exportCsv, !!table]].map(([l, f, ok]: any) => (
                <button key={l} role="menuitem" disabled={!ok} onClick={() => { f(); setMenu(false); }}
                  className="block w-full rounded-chip px-2 py-1.5 text-left text-xs hover:bg-sunk disabled:opacity-40">{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Distinct keys: ECharts' dispose() clears its container, so the table must not reuse that node. */}
      {showTable && table ? (
        <div key="table" className="overflow-auto" style={{ maxHeight: height }}>
          <table className="tbl num text-xs">
            <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? "—"}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div key="chart" ref={el} style={{ height, width: "100%" }} role="img" aria-label={`${title} chart. Use the Table button for the data.`} />
      )}
      {(source || n || asOf) && (
        <figcaption className="mt-1 flex flex-wrap gap-x-3 text-2xs text-muted">
          {asOf && <span>As of {asOf}</span>}
          {n != null && <span>n = {n}</span>}
          {source && <span className="font-mono">{source}</span>}
        </figcaption>
      )}
    </figure>
  );
}
