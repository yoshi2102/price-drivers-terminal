"use client";
import { useEffect, useState } from "react";
import { readPins, writePins, Pin } from "./studio-store";

type Pack = { id: string; name: string; kind: string; status: string; pins: string[] };
const STATUSES = ["Draft", "In review", "Approved for internal", "Approved for external"];
const KEY = "pdt.studio.packs";

export default function StudioView() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Sector note");
  useEffect(() => { setPins(readPins()); try { setPacks(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  const save = (p: Pack[]) => { setPacks(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Pinned charts and tables</h2>
        <p className="text-xs text-muted">Use “Pin” above any chart. Pins are saved in this browser until packs move to the shared database.</p>
        {pins.length === 0 ? <p className="mt-4 rounded-card border border-dashed border-line p-4 text-sm text-muted">Nothing pinned yet. Open a Sector or Stock page and pin a chart.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {pins.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0"><a href={p.page} className="text-sm text-ink hover:text-accent">{p.title}</a><div className="truncate font-mono text-2xs text-muted">{p.source || p.page}</div></div>
                <div className="flex shrink-0 gap-1">
                  {packs.length > 0 && <select aria-label={`Add ${p.title} to pack`} className="h-7 rounded-chip border border-line bg-surface text-2xs" defaultValue=""
                    onChange={(e) => { const id = e.target.value; if (!id) return; save(packs.map((k) => (k.id === id && !k.pins.includes(p.id) ? { ...k, pins: [...k.pins, p.id] } : k))); e.target.value = ""; }}>
                    <option value="">Add to pack</option>{packs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>}
                  <button onClick={() => { const n = pins.filter((x) => x.id !== p.id); setPins(n); writePins(n); }} className="h-7 rounded-chip px-2 text-2xs text-muted hover:bg-sunk">Remove</button>
                </div>
              </li>))}
          </ul>
        )}
      </section>
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Draft packs</h2>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; save([...packs, { id: Date.now().toString(36), name: name.trim(), kind, status: "Draft", pins: [] }]); setName(""); }}>
          <div className="flex-1"><label htmlFor="pn" className="block text-xs text-muted">Pack name</label>
            <input id="pn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cement: Q2 FY27 drivers" className="mt-1 h-9 w-full rounded-card border border-line bg-surface px-2 text-sm" /></div>
          <div><label htmlFor="pk" className="block text-xs text-muted">Type</label>
            <select id="pk" value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 h-9 rounded-card border border-line bg-surface px-2 text-sm">
              {["Sector note", "Monthly market pack", "Stock note"].map((k) => <option key={k}>{k}</option>)}</select></div>
          <button className="h-9 rounded-card bg-ink px-3 text-sm font-medium text-paper">Create pack</button>
        </form>
        {packs.length === 0 ? <p className="mt-4 text-sm text-muted">No packs yet.</p> : (
          <ul className="mt-4 space-y-3">
            {packs.map((k) => (
              <li key={k.id} className="rounded-card border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium">{k.name}</div><div className="text-2xs text-muted">{k.kind} · {k.pins.length} items</div></div>
                  <select aria-label="Compliance status" value={k.status} onChange={(e) => save(packs.map((x) => (x.id === k.id ? { ...x, status: e.target.value } : x)))} className="h-8 rounded-card border border-line bg-surface px-2 text-xs">
                    {STATUSES.map((s) => <option key={s} disabled={s === "Approved for external" && k.status !== "Approved for internal" && k.status !== s}>{s}</option>)}
                  </select>
                </div>
                {k.status === "Approved for external" && <p className="mt-2 text-2xs text-warn">External version: Bloomberg-licensed numbers and broker names are replaced with Buoyant-derived aggregates, and SEBI disclaimers are added on export.</p>}
                <ul className="mt-2 list-disc pl-5 text-xs text-muted">{k.pins.map((pid) => <li key={pid}>{pins.find((p) => p.id === pid)?.title || pid}</li>)}</ul>
              </li>))}
          </ul>
        )}
        <p className="mt-4 text-2xs text-muted">Approval for external use is only selectable after internal approval, and needs the compliance owner (open dependency). One-click export to Buoyant slide and document templates is P2.</p>
      </section>
    </div>
  );
}
