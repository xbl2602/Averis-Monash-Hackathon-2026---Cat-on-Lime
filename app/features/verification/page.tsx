import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { listProviderOptions } from "../../_lib/provider-options";
import { VerificationPanel } from "./ui";

export const metadata: Metadata = {
  title: "Full pipeline · Shipping Doc Verifier",
};

// Provider readiness comes from server environment variables, so it is read on every visit
export const dynamic = "force-dynamic";

export default function VerificationPage() {
  const providers = listProviderOptions().filter((p) => p.textCapable);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="All-in-one"
        title="Full pipeline"
        description="Classify, extract and compare a batch of sample emails in one run. Public runs are previews: results are calculated and shown here, never saved."
      />
      <VerificationPanel providers={providers} />
    </div>
  );
}
