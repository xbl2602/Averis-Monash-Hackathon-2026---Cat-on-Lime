import { PageHeader } from "../../_components/page-header";
import { ClassificationPanel } from "./ui";

export default function ClassificationPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Step 01"
        title="Email classification"
        description="Decide whether an email is a document comparison request, a new SI request, an invoice query, a general message or spam."
      />
      <ClassificationPanel />
    </div>
  );
}
