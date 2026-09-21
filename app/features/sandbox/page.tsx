import type { Metadata } from "next";
import { HeroBanner } from "../../_components/motion/hero-banner";
import { listProviderOptions } from "../../_lib/provider-options";
import { SandboxWorkbench } from "./ui/sandbox-workbench";

export const metadata: Metadata = {
  title: "Try your own files · Shipping Doc Verifier",
};

// Provider readiness comes from server environment variables
export const dynamic = "force-dynamic";

export default function SandboxPage() {
  return (
    <div className="space-y-8">
      <HeroBanner
        eyebrow="Try it"
        title="Bring your own"
        highlight="SI and BL."
        description="Drop in two shipping documents and watch them being read, compared and judged, exactly as the real pipeline would. Nothing is saved, and it works without a database."
      />
      <SandboxWorkbench providers={listProviderOptions()} />
    </div>
  );
}
