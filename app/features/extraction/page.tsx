import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { ExtractionPanel } from "./ui";

// The sample inbox is read from the server on every visit
export const dynamic = "force-dynamic";

export default async function ExtractionPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Extract fields"
        description="Pull the seven shipment fields (shipper, consignee, notify party, ports, container count and gross weight) out of any attachment, with the source line behind each value."
      />
      <ExtractionPanel emails={await listEmailOptions()} />
    </div>
  );
}
