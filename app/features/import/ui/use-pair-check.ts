"use client";

import { useCallback, useState } from "react";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { apiRequest, postJson } from "../../../_lib/api-client";
import type { DocumentDetail, DocumentListItem, SandboxResult } from "../../../_lib/contracts";

export interface Pair {
  si: DocumentListItem | null;
  bl: DocumentListItem | null;
}

/** UTF-8 text to base64, the form the sandbox endpoint takes files in. */
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

/**
 * Check two stored documents against each other. The pool keeps the text that was read from each file, so
 * this fetches both texts and sends them through the same engine as "Try your own files". The verdict is
 * therefore about the text that was read, which is what would be compared in a real run too.
 */
export function usePairCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ si: DocumentListItem; bl: DocumentListItem; data: SandboxResult } | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const run = useCallback(async (si: DocumentListItem, bl: DocumentListItem) => {
    setBusy(true);
    setError(null);
    setResult(null);

    const [siDoc, blDoc] = await Promise.all([
      apiRequest<DocumentDetail>(`/features/import/api/documents/${si.id}`),
      apiRequest<DocumentDetail>(`/features/import/api/documents/${bl.id}`),
    ]);
    const failed = !siDoc.ok ? siDoc : !blDoc.ok ? blDoc : null;
    if (failed || !siDoc.ok || !blDoc.ok) {
      setError(failed && !failed.ok ? failed.error : { message: "The documents could not be loaded." });
      setBusy(false);
      return;
    }
    if (!siDoc.data.extracted_text?.trim() || !blDoc.data.extracted_text?.trim()) {
      const which = !siDoc.data.extracted_text?.trim() ? si.file_name : bl.file_name;
      setError({ message: `No text could be read from ${which}, so it cannot be checked. Scanned or image-only files are not supported.` });
      setBusy(false);
      return;
    }

    const response = await postJson<SandboxResult>("/features/sandbox/api", {
      si: { name: `${si.file_name}.txt`, data_base64: textToBase64(siDoc.data.extracted_text) },
      bl: { name: `${bl.file_name}.txt`, data_base64: textToBase64(blDoc.data.extracted_text) },
    });
    setBusy(false);
    if (response.ok) setResult({ si, bl, data: response.data });
    else setError(response.error);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { run, busy, result, error, reset };
}
