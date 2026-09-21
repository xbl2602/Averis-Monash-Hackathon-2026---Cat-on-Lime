"use client";

import { useEffect, useState } from "react";

/**
 * Flips to true one animation frame after mount. Bars and rings render in their "empty" state first
 * and CSS transitions them to the real value when this flips, so they visibly draw in.
 */
export function useReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready;
}
