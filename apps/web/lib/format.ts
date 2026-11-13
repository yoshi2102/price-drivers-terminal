export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const pct = (v: unknown, dp = 1, sign = true) =>
  isNum(v) ? `${sign && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(dp)}%` : "—";
export const pp = (v: unknown, dp = 1) => (isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}` : "—");
export const num = (v: unknown, dp = 0) =>
  isNum(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }).replace("-", "−") : "—";
export const inr = (v: unknown, dp = 0) => (isNum(v) ? `₹${num(v, dp)}` : "—");
export const crore = (v: unknown) => (isNum(v) ? `₹${num(v, 0)} cr` : "—");
export const signClass = (v: unknown) => (isNum(v) ? (v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-muted") : "text-muted");
export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
