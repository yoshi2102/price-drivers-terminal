/* Shared types for snapshot JSON written by the worker (worker/pdt/run.py)
   and read by apps/web. Generate from db/schema.sql once Postgres is live. */
export type SnapshotManifest = {
  snapshot_id: string; created_at: string; as_of: string; code_hash: string; data_hash: string;
  model_versions: Record<string, string>; params: Record<string, unknown>; universe: Record<string, string>;
};
export type GateResult = { pass: boolean; value: string | number | null };
export type DriverResult = {
  code: string; label: string; group: "KPI" | "Surprise" | "Macro" | "Price"; prior: boolean;
  effect_sd: number; se: number; ci90: [number, number]; p: number; q: number; incremental_r2: number;
  oos_fold_share: number | null; placebo_pct: number; n_obs: number; n_stocks: number;
  gates: Record<"sign" | "bh" | "oos" | "regime" | "placebo" | "sample", GateResult>;
  validated: boolean; stability: "stable" | "regime-dependent" | "unstable"; label_status: "validated" | "unvalidated" | "unstable";
};
export type ForwardHorizon = {
  pct: Record<"p10" | "p25" | "p50" | "p75" | "p90", number>; p_beat_market: number;
  contrib: Record<string, number>; tornado: { input: string; low: number; high: number }[];
  cases: { case: "Bear" | "Base" | "Bull"; probability: number; eps_growth: number; implied_pe: number; implied_price: number; return: number }[];
};
