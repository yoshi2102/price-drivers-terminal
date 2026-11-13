import StudioView from "@/components/StudioView";
import { PageHead } from "@/components/ui";
export const metadata = { title: "Research studio" };
export default function Studio() {
  return (
    <>
      <PageHead kicker="Part B bridge" title="Research studio">Collect charts and tables into a draft pack, move it through compliance, and export what is approved.</PageHead>
      <StudioView />
    </>
  );
}
