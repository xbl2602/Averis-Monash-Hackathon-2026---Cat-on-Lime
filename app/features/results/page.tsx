import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../../_components/icon";
import { PageHeader } from "../../_components/page-header";
import { filtersFromParams } from "./ui/filters";
import { ResultsExplorer } from "./ui/results-explorer";

export const metadata: Metadata = {
  title: "Results · Shipping Doc Verifier",
};

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = filtersFromParams(await searchParams);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Results"
        description="Every email with its category, outcome and extracted fields. Open a row to see the SI and BL side by side, with the source line behind each value."
        action={
          <Link href="/features/results/conflicts" className="btn btn-glass self-start !py-2.5">
            <Icon name="swap" size={17} />
            Only the conflicts
          </Link>
        }
      />
      <ResultsExplorer initial={initial} />
    </div>
  );
}
