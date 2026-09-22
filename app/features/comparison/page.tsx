import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { ComparisonPanel } from "./ui";

// The sample inbox is read from the server on every visit
export const dynamic = "force-dynamic";

export default async function ComparisonPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Compare SI & BL"
        description="Compare the Bill of Lading draft against the Shipping Instruction field by field, show the differences, and flag anything a person should check."
      />
      <ComparisonPanel emails={await listEmailOptions()} />
    </div>
  );
}
