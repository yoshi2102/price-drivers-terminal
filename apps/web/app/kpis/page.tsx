import Link from "next/link";
import { PageHead, Card, Badge } from "@/components/ui";
import { kpiSectors, LIVE_MODEL } from "@/lib/data";

export const metadata = { title: "Sector KPI library" };

export default function KpiLibrary() {
  const all = kpiSectors();
  const groups = Array.from(new Set(all.map((s) => s.group)));
  const nKpi = all.reduce((a, s) => a + (s.kpis?.length || 0), 0);
  return (
    <>
      <PageHead kicker="Framework" title="Sector KPI library" meta={<span className="num">{all.length} sectors · {nKpi} KPIs</span>}>
        For every sector: how profit is built, what moves the share price, and the sector-specific KPIs to track, with where each KPI&apos;s history and forward estimates live in Airavat. Sector list and 2QFY27 read from MOFSL&apos;s India Strategy review (Nov 2026); KPI method from Buoyant&apos;s sector skills.
      </PageHead>
      {all.length === 0 ? <p className="text-sm text-muted">No sector files found. Add JSON files to config/sectors and rebuild.</p> : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g} title={g}>
              <div className="-mx-4 overflow-x-auto">
                <table className="tbl text-sm">
                  <thead><tr><th>Sector</th><th>Unit economics</th><th>Core KPIs</th><th>Valuation anchor</th><th>MOFSL 2QFY27</th></tr></thead>
                  <tbody>{all.filter((s) => s.group === g).map((s) => (
                    <tr key={s.code}>
                      <td className="min-w-[150px]">
                        <Link href={`/kpis/${s.code}`} className="font-medium text-accent hover:underline">{s.name}</Link>
                        {LIVE_MODEL[s.code] && <div className="mt-1"><Badge kind="pilot" text="Live model" /></div>}
                      </td>
                      <td className="min-w-[220px] max-w-[300px] font-mono text-2xs text-ink">{s.unit_economics}</td>
                      <td className="min-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {(s.kpis || []).filter((k: any) => k.priority === "core").map((k: any) => (
                            <span key={k.code} className="rounded-chip border border-line bg-sunk/60 px-1.5 py-0.5 text-2xs text-ink">{k.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="min-w-[160px] text-xs text-muted">{s.valuation_anchor}</td>
                      <td className="min-w-[220px] max-w-[320px] text-xs text-muted">{s.mofsl_2qfy27?.headline}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
