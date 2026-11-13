"use client";
/* Research Studio draft pins. Kept per viewer in localStorage until the
   Postgres-backed packs table is wired (see db/schema.sql: studio_pack). */
export type Pin = { id: string; title: string; source?: string; asOf?: string; page?: string; at?: string };
const KEY = "pdt.studio.pins";
export function readPins(): Pin[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function writePins(p: Pin[]) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }
export function pinToStudio(p: Pin) {
  const pins = readPins().filter((x) => x.id !== p.id);
  pins.push({ ...p, page: typeof location !== "undefined" ? location.pathname + location.search : undefined, at: new Date().toISOString() });
  writePins(pins);
}
