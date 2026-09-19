/** JSON 序列化：唯一的 JSON 出口，保证缩进/编码一致 */
export function toJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}
