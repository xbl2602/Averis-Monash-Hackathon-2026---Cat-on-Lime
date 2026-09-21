import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { JevLabPanel } from "./ui";

export const dynamic = "force-dynamic";

export default async function JevLabPage() {
  const options = await listEmailOptions();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lab"
        title="Model lab (Jev)"
        description="Try the Jev structured-decision model on a sample email: it picks from a fixed list of options, reports a calibrated confidence, and asks for a person when it is unsure. Switch to Claude to compare."
      />
      <JevLabPanel emails={options} />
    </div>
  );
}
