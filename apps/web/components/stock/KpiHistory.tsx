"use client";
import { useState } from "react";
import Chart from "@/components/Chart";

const OPTS: [string, string, number][] = [
  ["volume_growth", "Volume growth YoY (%)", 100], ["realisation_yoy", "Realisation/t YoY (%)", 100], ["cost_per_t_yoy", "Cost/t YoY (%)", 100],
["ebitda_margin_chg", "EBITDA margin change YoY (pp)", 1], ["revenue_yoy", "Revenue growth YoY (%)", 100],
  ["ebitda_sue", "EBITDA surprise (SUE)", 1],
];

export default function KpiHistory({ rows, asOf }: { rows: any[]; asOf: string }) {
  const avail = OPTS.filter(([k]) => rows.some((r) => r[k] != null));
  const [k, setK] = useState(avail[0]?.[0] || "revenue_yoy");
  const o = OPTS.find((x) => x[0] === k)!;
  const r = rows.filter((x) => x.y_window != null || x[k] != null);
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center gap-2">
        <label htmlFor="kpi" className="text-xs text-muted">Driver</label>
        <select id="kpi" value={k} onChange={(e) => setK(e.target.value)} className="h-8 rounded-card border border-line bg-surface px-2 text-sm">
          {avail.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <Chart title={`${o[1]} vs post-results return`} height={280} asOf={asOf} n={`${r.length} quarters`}
        option={{
          grid: { left: 48, right: 48, top: 30, bottom: 40 },
          legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "token:muted" } },
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: r.map((x) => x.period), axisLabel: { rotate: 45, fontSize: 10 } },
          yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
          series: [
            { name: "Specific return, day −1..+60", type: "bar", data: r.map((x) => (x.y_window == null ? null : +(x.y_window * 100).toFixed(2))),
              itemStyle: { color: "token:c-market/0.6" }, barWidth: "50%" },
            { name: o[1], type: "line", data: r.map((x) => (x[k] == null ? null : +(x[k] * o[2]).toFixed(2))), symbol: "circle", symbolSize: 5,
              lineStyle: { color: "token:accent", width: 1.75 }, itemStyle: { color: "token:accent" }, connectNulls: false },
          ],
        }}
        table={{ columns: ["Quarter", "Results date", "Date basis", o[1], "Specific return %"], rows: r.map((x) => [x.period, x.event_date, x.date_source, x[k] == null ? null : +(x[k] * o[2]).toFixed(2), x.y_window == null ? null : +(x.y_window * 100).toFixed(2)]) }} />
      <p className="mt-2 text-2xs text-muted">One axis: the driver and the return share the same percentage scale. Results dates and their basis are in the table view.</p>
    </div>
  );
}
