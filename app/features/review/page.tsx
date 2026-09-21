import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { listProviderOptions } from "../../_lib/provider-options";
import { REVIEW_MODULES, type ReviewModule } from "./ui/review-api";
import { ReviewWorkspace } from "./ui/review-workspace";

export const metadata: Metadata = {
  title: "Review queue · Shipping Doc Verifier",
};

// Provider readiness comes from server environment variables
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const requested = typeof params.module === "string" ? params.module : "";
  const module = REVIEW_MODULES.find((m) => m.key === requested)?.key ?? ("comparison" satisfies ReviewModule);
  const providers = listProviderOptions().filter((p) => p.textCapable);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Human in the loop"
        title="Review queue"
        description="Everything the system was not sure about, in one place. Confirm it, correct it, set it aside or re-run it. Every action is recorded and can be undone."
      />
      <ReviewWorkspace providers={providers} initialEmail={email} initialModule={module} />
    </div>
  );
}
