export interface DiffPart {
  text: string;
  /** "same" = matches the other side (ignoring case); "diff" = only on this side */
  kind: "same" | "diff";
}

const MAX_CHARS = 300;

/**
 * Character-level diff of two field values, so the eye lands on the exact letters that differ.
 * Case and repeated spaces are ignored on purpose (the engine treats them as formatting noise),
 * so "Singapore" vs "SINGAPORE" shows no highlight. Returns one part list per side.
 * Longer values fall back to "all different" rather than paying for a large comparison.
 */
export function diffValues(a: string, b: string): { left: DiffPart[]; right: DiffPart[] } {
  if (a.length > MAX_CHARS || b.length > MAX_CHARS) {
    return { left: [{ text: a, kind: "diff" }], right: [{ text: b, kind: "diff" }] };
  }

  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const n = x.length;
  const m = y.length;

  // Longest-common-subsequence table, then walk it back to mark which characters are shared
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  // Two values with little in common (a different company altogether) would light up scattered letters that
  // match by coincidence. That is noise, so mark the whole value as different instead.
  if (table[0][0] / Math.max(n, m, 1) < 0.5) {
    return { left: [{ text: a, kind: "diff" }], right: [{ text: b, kind: "diff" }] };
  }

  const sharedA = new Array<boolean>(n).fill(false);
  const sharedB = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      sharedA[i] = true;
      sharedB[j] = true;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return { left: toParts(a, sharedA), right: toParts(b, sharedB) };
}

function toParts(text: string, shared: boolean[]): DiffPart[] {
  const parts: DiffPart[] = [];
  for (let k = 0; k < text.length; k++) {
    const kind = shared[k] ? "same" : "diff";
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text[k];
    else parts.push({ text: text[k], kind });
  }
  return parts;
}
