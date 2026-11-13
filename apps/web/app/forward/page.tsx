import { Suspense } from "react";
import ForwardView from "@/components/ForwardView";
import { PageHead } from "@/components/ui";
import { load, stock, tickers } from "@/lib/data";

export const metadata = { title: "Forward paths" };

export default function Forward() {
  const fw = load("forward.json");
  const data: Record<string, any> = {};
  const names: Record<string, string> = {};
  for (const t of tickers()) { const s = stock(t); if (s.forward) { data[t] = s.forward; names[t] = s.name; } }
  return (
    <>
      <PageHead kicker="Phase 3" title="Forward paths">
        Probability ranges for 3, 6 and 12-month returns, the inputs that move them most, and what happens if your earnings view differs from the street.
      </PageHead>
      <Suspense><ForwardView data={data} names={names} calib={fw.calibration} engine={fw.engine} /></Suspense>
    </>
  );
}
