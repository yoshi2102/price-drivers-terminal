import { notFound } from "next/navigation";
import { BacktestView } from "@/components/BacktestView";
import { sectors } from "@/lib/data";

export function generateStaticParams() { return sectors().map((s) => ({ sector: s.code })); }
export const metadata = { title: "Backtest lab" };

export default async function BacktestSector({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  if (!sectors().some((s) => s.code === sector)) notFound();
  return <BacktestView code={sector} />;
}
