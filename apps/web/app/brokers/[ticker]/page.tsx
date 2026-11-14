import { notFound } from "next/navigation";
import { BrokersView } from "@/components/BrokersView";
import { load } from "@/lib/data";
export function generateStaticParams() { return Object.keys(load("brokers.json").tickers || {}).map((ticker) => ({ ticker })); }
export const metadata = { title: "Broker scorecard" };
export default async function BrokersTicker({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!(ticker in (load("brokers.json").tickers || {}))) notFound();
  return <BrokersView ticker={ticker} />;
}
