import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../../../_components/icon";
import { PageHeader } from "../../../_components/page-header";
import { ConflictsExplorer } from "../ui/conflicts-explorer";

export const metadata: Metadata = {
  title: "Conflicts · Shipping Doc Verifier",
};

export default function ConflictsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Conflicts"
        description="Where the draft BL disagrees with the SI, or the system could not tell. The differing characters are marked, and every value shows the line it came from."
        action={
          <Link href="/features/results" className="btn btn-glass self-start !py-2.5">
            <Icon name="table" size={17} />
            All results
          </Link>
        }
      />
      <ConflictsExplorer />
    </div>
  );
}
