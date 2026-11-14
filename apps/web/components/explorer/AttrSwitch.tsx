"use client";
import { useEffect, useState } from "react";
import Explorer from "./Explorer";
import { Badge } from "@/components/ui";

type S = { code: string; name: string; panel: any; names: Record<string, string>; en: any; tests: any[]; nObs: number };

export default function AttrSwitch({ items }: { items: S[] }) {
  const [code, setCode] = useState(items[0].code);
  useEffect(() => { const q = new URLSearchParams(location.search).get("s"); if (q && items.some((i) => i.code === q)) setCode(q); }, []); // eslint-disable-line
  const it = items.find((i) => i.code === code)!;
  const en = it.en;
  const kept = (en.coefs as any[]).filter((c) => Math.abs(c.coef) > 1e-9);
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-card border border-line bg-surface p-0.5" role="tablist" aria-label="Sector">
        {items.map((s) => (
          <button key={s.code} role="tab" aria-selected={s.code === code} onClick={() => { setCode(s.code); history.replaceState(null, "", `${location.pathname}?s=${s.code}`); }}
            className={`rounded-[4px] px-2.5 py-1 text-xs ${s.code === code ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{s.name}</button>
        ))}
      </div>
      <Explorer key={code} panel={it.panel} names={it.names} sector={code} />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Pre-run: elastic net, {it.name}</h2>
          <p className="text-xs text-muted">Standardised features, α = {en.alpha.toFixed(4)}, L1 ratio {en.l1_ratio}. In-sample R² {(en.in_sample_r2 * 100).toFixed(1)}%, out-of-sample {(en.oos_r2 * 100).toFixed(1)}%.</p>
          {kept.length === 0
            ? <p className="mt-3 text-sm text-muted">Cross-validation shrank every coefficient to zero: no candidate improves out-of-sample fit enough to keep, with {it.nObs} stock-quarters.</p>
            : <table className="tbl mt-3 text-sm"><tbody>{kept.map((c: any) => <tr key={c.feature}><td className="font-mono text-xs">{c.feature}</td><td className="r num">{(c.coef * 100).toFixed(2)}%</td></tr>)}</tbody></table>}
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Pre-run: registered driver tests, {it.name}</h2>
          <p className="text-xs text-muted">From the experiment registry, Benjamini-Hochberg at 10%.</p>
          <table className="tbl mt-3 text-sm">
            <thead><tr><th>Driver</th><th className="r">p</th><th className="r">q</th><th>Status</th></tr></thead>
            <tbody>{it.tests.map((r: any) => (
              <tr key={r.code}><td>{r.label}</td><td className="r num">{r.p.toFixed(3)}</td><td className="r num">{r.q.toFixed(3)}</td><td><Badge kind={r.label_status} /></td></tr>))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
