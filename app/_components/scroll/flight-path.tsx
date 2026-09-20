import { SEGMENT_COUNT } from "./flight-waypoints";

/**
 * The hidden skeleton of the page: one <path id="flight-path"> for the whole route, plus one path per
 * segment (that is what the rig samples, so speed stays even). Geometry is written by plane-rig.ts from
 * the waypoints whenever the viewport changes. Open the page with ?debug=path to see it.
 */
export function FlightPath() {
  return (
    <svg data-flight-svg className="flight-svg" aria-hidden="true">
      <path id="flight-path" data-flight-full fill="none" />
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <path key={i} data-flight-seg={i} fill="none" />
      ))}
    </svg>
  );
}
