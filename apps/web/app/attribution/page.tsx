import { Suspense } from "react";
import AttrSwitch from "@/components/explorer/AttrSwitch";
import { PageHead } from "@/components/ui";
import { load, sectors } from "@/lib/data";

export const metadata = { title: "Attribution explorer" };

export default function Attribution() {
  const items = sectors().map(({ code, name }) => {
    const p = load(`panel_${code}.json`);
    const s = load(`sector_${code}.json`);
    return {
      code, name, panel: p, names: p.names, en: s.discovery.elastic_net, nObs: s.discovery.n_obs,
      tests: (s.leaderboard as any[]).filter((r) => typeof r.p === "number").slice(0, 8)
        .map((r) => ({ code: r.code, label: r.label, p: r.p, q: r.q, label_status: r.label_status })),
    };
  });
  return (
    <>
      <PageHead kicker="Attribution" title="Attribution explorer">
        Pick a sector, the stocks, the window and the drivers; the regression re-runs in your browser on the published panel. Pre-run, registered results sit below and on each Sector page.
      </PageHead>
      <Suspense><AttrSwitch items={items} /></Suspense>
    </>
  );
}
