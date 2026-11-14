import { Suspense } from "react";
import EventsSwitch from "@/components/EventsSwitch";
import { PageHead } from "@/components/ui";
import { load, sectors } from "@/lib/data";

export const metadata = { title: "Event studies" };

const NOTE: Record<string, string> = {
  cement: "Most dates are earnings-call dates, usually results day or the next. Shree Cement has none usable (its calls run 4–6 days after results).",
  "it-services": "Large IT companies hold the call on results day, so call dates match results dates closely. Street surprises need pre-results previews, which are thin for IT so far.",
};

export default function Events() {
  const idx = load("index.json").stocks as any[];
  const names = Object.fromEntries(idx.map((x) => [x.ticker, x.name]));
  const items = sectors().map(({ code, name }) => {
    const e = load(`events_${code}.json`);
    return { code, name, studies: e.studies, nReal: e.n_real_dates, names, note: NOTE[code] || "" };
  });
  return (
    <>
      <PageHead kicker="Attribution" title="Event studies">
        How stocks trade around results, bucketed by the size of the surprise. Surprise is measured against each stock&apos;s own trend, and against broker previews and Bloomberg consensus where those were published before results.
      </PageHead>
      <Suspense><EventsSwitch items={items} /></Suspense>
    </>
  );
}
