import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { listProviderOptions } from "../../_lib/provider-options";
import { ExtractionPanel } from "./ui";

// Provider readiness and the sample inbox are read from the server on every visit
export const dynamic = "force-dynamic";

export default async function ExtractionPage() {
  // Extraction only accepts text models (Jev makes decisions, it does not write text)
  const providers = listProviderOptions().filter((p) => p.textCapable);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Step 02"
        title="Field extraction"
        description="Pull the seven shipment fields (shipper, consignee, notify party, ports, container count and gross weight) out of an email or its attachment."
      />
      <ExtractionPanel emails={await listEmailOptions()} providers={providers} />
    </div>
  );
}
