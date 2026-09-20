import { listSampleEmails } from "@/lib/shared/inbox";
import { PageHeader } from "../../_components/page-header";
import { JevLabPanel } from "./ui";

export default async function JevLabPage() {
  const emails = await listSampleEmails();
  const options = emails.map((email) => ({
    email_id: email.email_id,
    subject: email.subject,
  }));

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
