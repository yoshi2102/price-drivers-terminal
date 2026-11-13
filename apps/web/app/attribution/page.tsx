import { Suspense } from "react";
import Explorer from "@/components/explorer/Explorer";
import { PageHead, Card, Badge } from "@/components/ui";
import { load } from "@/lib/data";
import { pct, isNum } from "@/lib/format";

export const metadata = { title: "Attribution explorer" };

export default function Attribution() {
  const panel = load("panel.json");
  const idx = load("index.json").stocks as any[];
  const s = load("sector_cement.json");
  const en = s.discovery.elastic_net;
  return (
    <>
      <PageHead kicker="Attribution" title="Attribution explorer">
        Pick the stocks, the window and the drivers; the regression re-runs in your browser on the published panel. Pre-run, registered results sit below and on the Sector page.
      </PageHead>
      <Suspense><Explorer panel={panel} names={Object.fromEntries(idx.map((x) => [x.ticker, x.name]))} /></Suspense>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Pre-run: elastic net coefficients" sub={`Standardised features, α = ${en.alpha.toFixed(4)}, L1 ratio ${en.l1_ratio}. In-sample R² ${pct(en.in_sample_r2, 1, false)}, out-of-sample ${pct(en.oos_r2, 1)}.`}>
          {en.coefs.filter((c: any) => Math.abs(c.coef) > 1e-9).length === 0
            ? <p className="text-sm text-muted">Cross-validation shrank every coefficient to zero: no candidate improves out-of-sample fit enough to keep. That is the honest answer with {s.discovery.n_obs} stock-quarters.</p>
            : <table className="tbl text-sm"><tbody>{en.coefs.filter((c: any) => Math.abs(c.coef) > 1e-9).map((c: any) => <tr key={c.feature}><td className="font-mono text-xs">{c.feature}</td><td className="r num">{(c.coef * 100).toFixed(2)}%</td></tr>)}</tbody></table>}
        </Card>
        <Card title="Pre-run: registered driver tests" sub="From the experiment registry, Benjamini-Hochberg at 10%.">
          <table className="tbl text-sm">
            <thead><tr><th>Driver</th><th className="r">p</th><th className="r">q</th><th>Status</th></tr></thead>
            <tbody>{(s.leaderboard as any[]).filter((r) => isNum(r.p)).slice(0, 8).map((r) => (
              <tr key={r.code}><td>{r.label}</td><td className="r num">{r.p.toFixed(3)}</td><td className="r num">{r.q.toFixed(3)}</td><td><Badge kind={r.label_status} /></td></tr>))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
