/** JSON serialization: the single JSON exit point, ensuring consistent indentation/encoding */
export function toJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}
