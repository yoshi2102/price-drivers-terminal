/* Within-stock (stock fixed effect) OLS with standard errors clustered by
   stock, plus walk-forward out-of-sample R² with a one-quarter embargo.
   Small k, so normal equations are fine. */
export type Obs = { s: string; t: number; y: number; x: number[] };

function inv(A: number[][]): number[][] | null {
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r.slice(n));
}

function demean(obs: Obs[]) {
  const g = new Map<string, Obs[]>(); obs.forEach((o) => { if (!g.has(o.s)) g.set(o.s, []); g.get(o.s)!.push(o); });
  const out: Obs[] = []; const means = new Map<string, { y: number; x: number[] }>();
  for (const [s, rows] of g) {
    const k = rows[0].x.length, my = rows.reduce((a, r) => a + r.y, 0) / rows.length;
    const mx = Array.from({ length: k }, (_, j) => rows.reduce((a, r) => a + r.x[j], 0) / rows.length);
    means.set(s, { y: my, x: mx });
    rows.forEach((r) => out.push({ s, t: r.t, y: r.y - my, x: r.x.map((v, j) => v - mx[j]) }));
  }
  return { out, means };
}

export function fit(obs: Obs[]) {
  const k = obs[0]?.x.length ?? 0;
  const { out } = demean(obs);
  const XtX = Array.from({ length: k }, () => Array(k).fill(0)), Xty = Array(k).fill(0);
  out.forEach((o) => { for (let i = 0; i < k; i++) { Xty[i] += o.x[i] * o.y; for (let j = 0; j < k; j++) XtX[i][j] += o.x[i] * o.x[j]; } });
  const Ai = inv(XtX); if (!Ai) return null;
  const b = Ai.map((r) => r.reduce((a, v, j) => a + v * Xty[j], 0));
  const res = out.map((o) => o.y - o.x.reduce((a, v, j) => a + v * b[j], 0));
  const sst = out.reduce((a, o) => a + o.y * o.y, 0), sse = res.reduce((a, e) => a + e * e, 0);
  // cluster-robust (by stock) sandwich
  const meat = Array.from({ length: k }, () => Array(k).fill(0));
  const byS = new Map<string, number[]>();
  out.forEach((o, i) => { const u = byS.get(o.s) || Array(k).fill(0); for (let j = 0; j < k; j++) u[j] += o.x[j] * res[i]; byS.set(o.s, u); });
  for (const u of byS.values()) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) meat[i][j] += u[i] * u[j];
  const G = byS.size, n = out.length, adj = G > 1 ? (G / (G - 1)) * ((n - 1) / Math.max(n - k - G, 1)) : 1;
  const V = Ai.map((r) => Ai[0].map((_, j) => r.reduce((a, _v, m) => a + r[m] * meat[m].reduce((aa, vv, q) => aa + vv * Ai[q][j], 0), 0) * adj));
  const se = b.map((_, i) => Math.sqrt(Math.max(V[i][i], 0)));
  return { b, se, r2: sst > 0 ? 1 - sse / sst : 0, n, groups: G };
}

export function walkForward(obs: Obs[], minQ = 8) {
  const ts = [...new Set(obs.map((o) => o.t))].sort((a, b) => a - b);
  const folds: number[] = []; let sseM = 0, sseB = 0;
  for (const T of ts.slice(minQ)) {
    const tr = obs.filter((o) => o.t < T - 1), te = obs.filter((o) => o.t === T);
    if (tr.length < 20 || te.length < 3) continue;
    const f = fit(tr); if (!f) continue;
    const { means } = demean(tr);
    const gm = tr.reduce((a, o) => a + o.y, 0) / tr.length;
    let sm = 0, sb = 0;
    te.forEach((o) => {
      const m = means.get(o.s); const base = m ? m.y : gm;
      const pred = base + o.x.reduce((a, v, j) => a + (v - (m ? m.x[j] : 0)) * f.b[j], 0);
      sm += (o.y - pred) ** 2; sb += (o.y - base) ** 2;
    });
    folds.push(sb > 0 ? 1 - sm / sb : 0); sseM += sm; sseB += sb;
  }
  return { folds, pooled: sseB > 0 ? 1 - sseM / sseB : null };
}

export function pNorm(z: number) { // two-sided p from z, Abramowitz-Stegun erf
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return 1 - e;
}
