import { BrokersView } from "@/components/BrokersView";
import { load } from "@/lib/data";
export const metadata = { title: "Broker scorecard" };
export default function Brokers() { return <BrokersView ticker={Object.keys(load("brokers.json").tickers || {})[0] || "ULTRACEMCO"} />; }
