"use client";

import { useEffect, useRef } from "react";
import { FlightPath } from "./flight-path";
import { PaperPlane } from "./paper-plane";
import { PlaneRig } from "./plane-rig";
import { useStory } from "./story-context";

/**
 * The fixed layer that holds the ONE plane for the whole page. Mounted once, never remounted or
 * duplicated between scenes: all movement comes from PlaneRig reading the page's scroll position.
 */
export function PlaneLayer() {
  const { mode } = useStory();
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "static" || !layerRef.current) return;
    const rig = new PlaneRig(layerRef.current, mode);
    return rig.mount();
  }, [mode]);

  if (mode === "static") return null;

  return (
    <div ref={layerRef} className="plane-layer" aria-hidden="true">
      <FlightPath />
      <div data-plane className="plane" style={{ opacity: 0 }}>
        <PaperPlane />
      </div>
    </div>
  );
}
