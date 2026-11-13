import { Suspense } from "react";
import EventView from "@/components/EventView";
import { PageHead, Note } from "@/components/ui";
import { load } from "@/lib/data";

export const metadata = { title: "Event studies" };

export default function Events() {
  const e = load("events.json");
  const idx = load("index.json").stocks as any[];
  return (
    <>
      <PageHead kicker="Attribution" title="Event studies">
        How cement stocks trade around results, bucketed by the size of the surprise. Surprise is growth against each stock&apos;s own trailing trend, scaled by its history, until day-before consensus by quarter is stored.
      </PageHead>
      <div className="mb-5"><Note tone="warn">{e.n_real_dates} stock-quarters have an announced results date (UltraTech, Dalmia and JK Cement from board letters and transcripts; ACC, Ambuja and Ramco from call dates). Shree, Nuvoco, JK Lakshmi, Birla, Heidelberg and Star have none on file, so they are left out of these curves. Labs dependency: results timestamps per company and quarter.</Note></div>
      <Suspense><EventView studies={e.studies} names={Object.fromEntries(idx.map((x) => [x.ticker, x.name]))} /></Suspense>
    </>
  );
}
