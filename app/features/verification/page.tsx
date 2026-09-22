import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { listProviderOptions } from "../../_lib/provider-options";
import { VerificationPanel } from "./ui";

export const metadata: Metadata = {
  title: "Run verification · Shipping Doc Verifier",
};

// Provider readiness comes from server environment variables, so it is read on every visit
export const dynamic = "force-dynamic";

export default function VerificationPage() {
  const providers = listProviderOptions().filter((p) => p.textCapable);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Run verification"
        description="Sort a batch of emails, read their SI and BL attachments and compare them in one go. A preview shows the outcome without saving anything."
      />
      <VerificationPanel providers={providers} />
    </div>
  );
}
