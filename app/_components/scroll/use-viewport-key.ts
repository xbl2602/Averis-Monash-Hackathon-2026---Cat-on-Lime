"use client";

import { useEffect, useState } from "react";

/**
 * Changes whenever the viewport size settles on a new value. Scenes list it as a dependency so their
 * timelines are rebuilt with fresh pixel measurements after a resize (debounced, so dragging the
 * window edge does not rebuild on every frame).
 */
export function useViewportKey(): string {
  const [key, setKey] = useState("");

  useEffect(() => {
    const read = () => setKey(`${window.innerWidth}x${window.innerHeight}`);
    read();
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 220);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return key;
}
