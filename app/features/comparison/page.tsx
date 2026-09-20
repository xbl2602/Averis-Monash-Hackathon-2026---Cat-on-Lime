import { PageHeader } from "../../_components/page-header";
import { ComparisonPanel } from "./ui";

export default function ComparisonPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Step 03"
        title="SI / BL comparison"
        description="Compare the Bill of Lading draft against the Shipping Instruction field by field, show the differences, and flag anything a person should check."
      />
      <ComparisonPanel />
    </div>
  );
}
