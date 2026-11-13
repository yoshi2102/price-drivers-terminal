"use client";
import { useState } from "react";
import Chart from "@/components/Chart";

type W = { market: number; sector: number; style: number; specific: number; total: number; specific_earnings: number | null; specific_rest: number | null; earnings_total: number | null };

export default function Waterfall({ windows, asOf }: { windows: Record<string, W>; asOf: string }) {
  const [w, setW] = useState("3m");
  const d = windows[w];
  const steps: [string, number, string][] = [
    ["Market", d.market, "token:c-market"], ["Sector", d.sector, "token:c-sector"], ["Style", d.style, "token:c-style"],
    ["Earnings vs peers", d.specific_earnings ?? 0, "token:c-specific"],
    ["Re-rating, news", d.specific_rest ?? d.specific, "token:c-specific/0.55"],
  ];
  // floating bars drawn as [start, end] ranges with a custom series
  let run = 0;
  const data = steps.map(([name, v, c]) => { const a = run; run += v * 100; return { name, value: [name, +a.toFixed(2), +run.toFixed(2), +(v * 100).toFixed(2)], color: c }; });
  data.push({ name: "Total", value: ["Total", 0, +(d.total * 100).toFixed(2), +(d.total * 100).toFixed(2)], color: "token:ink" });
  const cats = data.map((x) => x.name);
  const option = {
    grid: { left: 44, right: 12, top: 18, bottom: 54 },
    tooltip: { trigger: "item", formatter: (p: any) => `${p.value[0]}: ${p.value[3] > 0 ? "+" : ""}${p.value[3].toFixed(2)}%` },
    xAxis: { type: "category", data: cats, axisLabel: { interval: 0, width: 92, overflow: "break", fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
    series: [{
      type: "custom",
      encode: { x: 0, y: [1, 2] },
      data: data.map((x) => ({ value: x.value, itemStyle: { color: x.color } })),
    }],
  };
  // Colours resolve from tokens inside Chart; renderItem reads them via api.visual.
  (option.series[0] as any).renderItem = (params: any, api: any) => {
    const x = api.coord([api.value(0), 0])[0];
    const y0 = api.coord([api.value(0), api.value(1)])[1];
    const y1 = api.coord([api.value(0), api.value(2)])[1];
    const bw = api.size([1, 0])[0] * 0.56;
    const v = api.value(3);
    return {
      type: "group",
      children: [
        { type: "rect", shape: { x: x - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(Math.abs(y1 - y0), 1) }, style: { fill: api.visual("color") } },
        { type: "text", style: { text: `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`, x, y: Math.min(y0, y1) - 4, align: "center", verticalAlign: "bottom", fontSize: 10, fontFamily: "JetBrains Mono", fill: api.visual("color") } },
      ],
    };
  };
  return (
    <div>
      <div className="mb-10 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-card border border-line bg-surface p-0.5" role="tablist" aria-label="Window">
          {["1m", "3m", "12m"].map((k) => (
            <button key={k} role="tab" aria-selected={w === k} onClick={() => setW(k)}
              className={`rounded-[4px] px-2.5 py-1 text-xs ${w === k ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{k.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <Chart title={`Return bridge ${w}`} height={260} asOf={asOf} source="factor model attr-1.0 · [ACE LTM EPS]" option={option}
        table={{ columns: ["Component", "Log return %"], rows: data.map((x) => [x.name, x.value[3] as number]) }} />
      <p className="mt-2 text-2xs text-muted">Log-return points, signed. Earnings vs peers = this stock&apos;s trailing-EPS growth minus the peer average over the window.</p>
    </div>
  );
}
