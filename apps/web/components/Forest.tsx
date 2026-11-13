/* Inline 90% CI whisker on a shared scale; meaning carried by position and sign text, not colour alone. */
export default function Forest({ b, lo, hi, scale, w = 140 }: { b: number; lo: number; hi: number; scale: number; w?: number }) {
  const x = (v: number) => w / 2 + (Math.max(-scale, Math.min(scale, v)) / scale) * (w / 2 - 4);
  const crosses = lo < 0 && hi > 0;
  return (
    <svg width={w} height={16} viewBox={`0 0 ${w} 16`} role="img" aria-label={`estimate ${(b * 100).toFixed(1)}%, 90% interval ${(lo * 100).toFixed(1)}% to ${(hi * 100).toFixed(1)}%`}>
      <line x1={w / 2} x2={w / 2} y1={1} y2={15} stroke="rgb(var(--line))" />
      <line x1={x(lo)} x2={x(hi)} y1={8} y2={8} stroke={crosses ? "rgb(var(--muted))" : "rgb(var(--accent))"} strokeWidth={1.5} />
      <rect x={x(b) - 3} y={5} width={6} height={6} fill={crosses ? "rgb(var(--muted))" : "rgb(var(--accent))"} />
    </svg>
  );
}
