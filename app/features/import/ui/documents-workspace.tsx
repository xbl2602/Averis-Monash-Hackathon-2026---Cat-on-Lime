"use client";

import { useState } from "react";
import { DatabaseDown } from "../../../_components/results/states";
import { queryString } from "../../../_lib/api-client";
import type { DocumentList } from "../../../_lib/contracts";
import { useApi } from "../../../_lib/use-api";
import { DocumentPool, type PoolFilters } from "./document-pool";
import { UploadPanel } from "./upload-panel";

const PAGE_SIZE = 15;

export function DocumentsWorkspace() {
  const [filters, setFilters] = useState<PoolFilters>({ reviewStatus: "", detectedType: "", offset: 0 });
  const pool = useApi<DocumentList>(
    `/features/import/api/documents${queryString({ review_status: filters.reviewStatus, detected_type: filters.detectedType, limit: PAGE_SIZE, offset: filters.offset })}`
  );

  // Uploads and the pool both live in the database, so without one there is nothing to show
  if (pool.databaseDown) return <DatabaseDown what="The document pool" />;

  return (
    <div className="space-y-8">
      <UploadPanel onUploaded={pool.reload} />
      <DocumentPool data={pool.data} loading={pool.loading} error={pool.error} onRetry={pool.reload} filters={filters} onFilters={(next) => setFilters((f) => ({ ...f, ...next }))} onChanged={pool.reload} />
    </div>
  );
}
