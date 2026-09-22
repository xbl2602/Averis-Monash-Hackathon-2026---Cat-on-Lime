import { PageHeader } from "../../_components/page-header";
import { listEmailOptions } from "../../_lib/email-options";
import { ClassificationPanel } from "./ui";

// The sample inbox is read from the server on every visit
export const dynamic = "force-dynamic";

export default async function ClassificationPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Classify emails"
        description="Find out whether an email is a document comparison request, a new SI request, an invoice query, a general message or spam."
      />
      <ClassificationPanel emails={await listEmailOptions()} />
    </div>
  );
}
