"use client";

import dynamic from "next/dynamic";

// Client-only: the plane needs window, layout measurements and GSAP. The page's text is all server-rendered.
export const PlaneLayerLazy = dynamic(() => import("./plane-layer").then((m) => m.PlaneLayer), { ssr: false });
