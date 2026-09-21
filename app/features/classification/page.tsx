import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { listProviderOptions } from "../../_lib/provider-options";
import { ClassificationPanel } from "./ui";

// Provider readiness and the sample inbox are read from the server on every visit
export const dynamic = "force-dynamic";

export default async function ClassificationPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Step 01"
        title="Email classification"
        description="Decide whether an email is a document comparison request, a new SI request, an invoice query, a general message or spam."
      />
      <ClassificationPanel emails={await listEmailOptions()} providers={listProviderOptions()} />
    </div>
  );
}
