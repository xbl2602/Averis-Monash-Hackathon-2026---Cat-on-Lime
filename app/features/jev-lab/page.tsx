import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { JevLabPanel } from "./ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model lab (Jev) · Shipping Doc Verifier",
  // Engineering comparison tool, not a product page: left out of the main nav (see nav-items.ts).
  robots: { index: false, follow: false },
};

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
