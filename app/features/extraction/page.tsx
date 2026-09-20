import { PageHeader } from "../../_components/page-header";
import { ExtractionPanel } from "./ui";

export default function ExtractionPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Step 02"
        title="Field extraction"
        description="Pull the seven shipment fields (shipper, consignee, notify party, ports, container count and gross weight) out of an email or its attachment."
      />
      <ExtractionPanel />
    </div>
  );
}
