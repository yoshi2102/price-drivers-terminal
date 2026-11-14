"use client";
import { useEffect, useState } from "react";
import EventView from "./EventView";

type S = { code: string; name: string; studies: Record<string, any>; nReal: number; names: Record<string, string>; note: string };

export default function EventsSwitch({ items }: { items: S[] }) {
  const [code, setCode] = useState(items[0].code);
  useEffect(() => { const q = new URLSearchParams(location.search).get("s"); if (q && items.some((i) => i.code === q)) setCode(q); }, []); // eslint-disable-line
  const it = items.find((i) => i.code === code)!;
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-card border border-line bg-surface p-0.5" role="tablist" aria-label="Sector">
        {items.map((s) => (
          <button key={s.code} role="tab" aria-selected={s.code === code} onClick={() => { setCode(s.code); history.replaceState(null, "", `${location.pathname}?s=${s.code}`); }}
            className={`rounded-[4px] px-2.5 py-1 text-xs ${s.code === code ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{s.name}</button>
        ))}
      </div>
      <p className="rounded-card border-l-2 border-warn bg-warn/5 px-3 py-2 text-xs text-ink">{it.nReal} stock-quarters have an announced or call-day results date. {it.note}</p>
      <EventView key={code} studies={it.studies} names={it.names} sector={code} />
    </div>
  );
}
