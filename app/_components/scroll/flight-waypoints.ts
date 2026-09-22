/**
 * The skeleton of the whole page: the plane's route, as waypoints in viewport fractions (x, y).
 * Text sits on the left of every pinned scene and the visual on the right, so the route lives
 * mostly on the right half. Waypoint 0 is replaced at runtime by the hero report card's position.
 *
 * The plane's position along the route is one number, u:
 *   u = 3.4 means "40% of the way from waypoint 3 to waypoint 4".
 * The master timeline in plane-rig.ts moves u through these ranges as the page scrolls.
 */
export type Vec = [number, number];

export const WAYPOINTS: Vec[] = [
  /* 0 */ [0.77, 0.4], // hero card (replaced at runtime)
  /* 1 */ [0.72, 0.14], // lifts off above the card
  /* 2 */ [0.52, 0.28], // banks left, enters the inbox from the top
  /* 3 */ [0.6, 0.5],
  /* 4 */ [0.74, 0.66],
  /* 5 */ [0.88, 0.52],
  /* 6 */ [0.92, 0.3], // swings round the right edge
  /* 7 */ [0.86, 0.14], // top of the scanner scene
  /* 8 */ [0.74, 0.42], // through the beam
  /* 9 */ [0.66, 0.68], // lands as the SI sheet
  /* 10 */ [0.68, 0.92], // slips out below the report
  /* 11 */ [0.53, 0.72],
  /* 12 */ [0.6, 0.52], // hesitates at the fork
  /* 13 */ [0.86, 0.24], // human marker
  /* 14 */ [1.12, 0.05], // leaves through the top-right corner; flies back in to dock in the final card
];

export const SEGMENT_COUNT = WAYPOINTS.length - 1;

/** u at the boundaries of each scene */
export const U = {
  heroEnd: 2,
  inboxEnd: 6,
  scannerEnd: 9,
  compareEnd: 10,
  handoffHover: 11.6,
  handoffNode: 12,
  handoffEnd: 13,
  landingEnd: 14,
} as const;
