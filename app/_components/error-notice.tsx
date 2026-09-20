import type { ApiErrorInfo } from "./api-error";
import { Notice } from "./notice";

/** Error box with the raw server text tucked into a collapsed block. */
export function ErrorNotice({ error }: { error: ApiErrorInfo }) {
  return (
    <Notice tone="bad" title="That didn't work">
      <p>{error.message}</p>
      {error.detail && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-fg-faint hover:text-fg-muted">Technical detail</summary>
          <p className="mt-1 break-words font-mono">{error.detail}</p>
        </details>
      )}
    </Notice>
  );
}
