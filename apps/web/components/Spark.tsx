export default function Spark({ data, w = 96, h = 24 }: { data: number[]; w?: number; h?: number }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * (h - 2) - 1}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className={up ? "text-pos" : "text-neg"}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function ShareBar({ share }: { share: Record<string, number> }) {
  const keys = ["market", "sector", "style", "specific"] as const;
  const tot = keys.reduce((a, k) => a + Math.max(share?.[k] ?? 0, 0), 0) || 1;
  const cls: Record<string, string> = { market: "bg-c-market", sector: "bg-c-sector", style: "bg-c-style", specific: "bg-c-specific" };
  return (
    <div className="flex h-2.5 w-full min-w-[120px] overflow-hidden rounded-chip bg-sunk" role="img"
      aria-label={keys.map((k) => `${k} ${Math.round((share?.[k] ?? 0) * 100)}%`).join(", ")}>
      {keys.map((k) => <span key={k} className={cls[k]} style={{ width: `${(Math.max(share?.[k] ?? 0, 0) / tot) * 100}%` }} title={`${k}: ${Math.round((share?.[k] ?? 0) * 100)}%`} />)}
    </div>
  );
}

export function Legend4() {
  const items = [["Market", "bg-c-market"], ["Sector", "bg-c-sector"], ["Style", "bg-c-style"], ["Stock-specific", "bg-c-specific"]];
  return (
    <div className="flex flex-wrap gap-3 text-2xs text-muted">
      {items.map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-[2px] ${c}`} />{l}</span>)}
    </div>
  );
}
