import { DevModeRequestError } from "./errors";

/**
 * 第二道门槛：光有 x-admin-token 不够，请求体里还要逐字符带上指定短语，
 * 防止"口令已经配在某个自动化脚本/剪贴板里，手滑触发"这种场景。
 */
export function assertConfirmPhrase(body: unknown, expectedPhrase: string): void {
  const confirm = body !== null && typeof body === "object" ? (body as Record<string, unknown>).confirm : undefined;
  if (confirm !== expectedPhrase) {
    throw new DevModeRequestError(
      `这是破坏性操作，需要在请求体里传 { "confirm": "${expectedPhrase}" }（必须逐字匹配）才会执行，当前未匹配`
    );
  }
}
