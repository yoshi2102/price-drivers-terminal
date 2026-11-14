import "server-only";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

/* The app reads only precomputed JSON from the latest published snapshot.
   In production the same interface reads model_output rows from Postgres
   (see db/schema.sql); pages never call Airavat or run models. */
const DIR = path.join(process.cwd(), "data");
const cache = new Map<string, unknown>();

export function load<T = any>(name: string): T {
  if (cache.has(name)) return cache.get(name) as T;
  const p = path.join(DIR, name);
  if (!existsSync(p)) throw new Error(`Snapshot file missing: ${name}. Run the worker (python -m pdt.run).`);
  const v = JSON.parse(readFileSync(p, "utf8"));
  cache.set(name, v);
  return v as T;
}
export const manifest = () => load("manifest.json");
export const stock = (t: string) => load(`stocks/${t}.json`);
export const tickers = (): string[] =>
  readdirSync(path.join(DIR, "stocks")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
export type SectorRef = { code: string; name: string };
export const sectors = (): SectorRef[] =>
  Object.entries((manifest().sectors || { cement: "Cement" }) as Record<string, string>).map(([code, name]) => ({ code, name }));
export const sectorOf = (t: string): string => {
  const row = (load("index.json").stocks as any[]).find((s) => s.ticker === t);
  return row?.sector || "cement";
};
