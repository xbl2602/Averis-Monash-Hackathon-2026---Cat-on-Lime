"use client";

import { useEffect, useState } from "react";

/** The value, but only after it has stopped changing for `delay` ms (keeps search boxes from firing on every keystroke). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
