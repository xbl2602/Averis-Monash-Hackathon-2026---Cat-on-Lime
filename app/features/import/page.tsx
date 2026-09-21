import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { DocumentsWorkspace } from "./ui/documents-workspace";

export const metadata: Metadata = {
  title: "Documents · Shipping Doc Verifier",
};

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Documents"
        description="Add SI and BL files to the shared pool. Each one is identified by what is inside it, and anything the system cannot recognise waits here for a person to file."
      />
      <DocumentsWorkspace />
    </div>
  );
}
