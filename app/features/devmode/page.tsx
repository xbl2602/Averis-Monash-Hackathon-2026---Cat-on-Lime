import type { Metadata } from "next";
import { PageHeader } from "../../_components/page-header";
import { DevModeWorkspace } from "./ui/devmode-workspace";

export const metadata: Metadata = {
  title: "Developer mode · Shipping Doc Verifier",
  // Not a product page: keep it out of search results and link previews.
  robots: { index: false, follow: false },
};

export default function DevModePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Internal tool"
        title="Developer mode"
        description="Reset the shared database for a clean demo run, or bring it back to the official sample. Not part of the product — see the warning below before touching anything."
      />
      <DevModeWorkspace />
    </div>
  );
}
