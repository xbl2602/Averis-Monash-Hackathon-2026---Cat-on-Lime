"use client";

import { useCallback, useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { useToast } from "../../../_components/toast";
import {
  reviewBase,
  type ApplyReviewActionRequest,
  type ApplyReviewActionResult,
  type BulkReviewActionResult,
  type ReviewModule,
} from "./review-api";

const ACTION_DONE: Record<string, string> = {
  confirm: "Confirmed",
  correct: "Correction saved",
  disposition: "Destination set",
  defer: "Set aside",
  undefer: "Brought back to the queue",
  note: "Note added",
  rerun: "Pipeline re-run",
};

/**
 * The write half of the review screen: apply, undo and bulk. Each call reports through a toast, and a
 * 409 (someone else changed the item first) is returned to the caller so it can offer a reload.
 */
export function useReviewActions(module: ReviewModule) {
  const { adminRequest } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const finish = useCallback(
    <T,>(result: { ok: true; data: T } | { ok: false; status: number; error: ApiErrorInfo }, success: string): T | null => {
      setBusy(false);
      if (result.ok) {
        setConflict(false);
        setError(null);
        toast({ tone: "ok", title: success });
        return result.data;
      }
      setConflict(result.status === 409);
      setError(result.error);
      if (result.status !== 401 && result.status !== 403) toast({ tone: "bad", title: "That did not save", detail: result.error.message });
      return null;
    },
    [toast]
  );

  const apply = useCallback(
    async (request: ApplyReviewActionRequest) => {
      setBusy(true);
      const result = await adminRequest<ApplyReviewActionResult>(reviewBase(module), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return finish(result, ACTION_DONE[request.action] ?? "Saved");
    },
    [adminRequest, module, finish]
  );

  const undo = useCallback(
    async (emailId: string, expectedUpdatedAt?: string) => {
      setBusy(true);
      const result = await adminRequest<ApplyReviewActionResult>(`${reviewBase(module)}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: emailId, ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}) }),
      });
      return finish(result, "Last action undone");
    },
    [adminRequest, module, finish]
  );

  const bulk = useCallback(
    async (emailIds: string[], action: "confirm" | "disposition" | "defer", payload?: ApplyReviewActionRequest["payload"]) => {
      setBusy(true);
      const result = await adminRequest<BulkReviewActionResult>(`${reviewBase(module)}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_ids: emailIds, action, ...(payload ? { payload } : {}) }),
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        if (result.status !== 401 && result.status !== 403) toast({ tone: "bad", title: "The batch did not run", detail: result.error.message });
        return null;
      }
      const { succeeded, failed } = result.data;
      toast({
        tone: failed.length === 0 ? "ok" : "warn",
        title: failed.length === 0 ? `${succeeded.length} updated` : `${succeeded.length} updated, ${failed.length} failed`,
        detail: failed.length > 0 ? `${failed[0].email_id}: ${failed[0].error}` : undefined,
      });
      return result.data;
    },
    [adminRequest, module, toast]
  );

  return { apply, undo, bulk, busy, conflict, error, clearError: () => { setError(null); setConflict(false); } };
}
