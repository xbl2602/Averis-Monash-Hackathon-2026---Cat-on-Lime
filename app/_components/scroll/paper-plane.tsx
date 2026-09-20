/**
 * The protagonist: one sheet of paper that folds into a plane. Three panels (left wing, right wing,
 * keel), pure SVG shapes inside CSS 3D transforms, so it inherits the theme (--plane* tokens) and
 * costs no image. The rig in plane-rig.ts sets every transform and polygon; this file is markup only.
 *
 *   flat page  (fold 0): the two wing polygons are the two halves of a rectangle, with text lines
 *   paper plane (fold 1): the top corners have folded to the crease and the wings tilt up 62 degrees
 */
export const PLANE_W = 100;
export const PLANE_H = 130;

const LINES = [16, 28, 40, 52, 64, 76, 88];

export function PaperPlane() {
  return (
    <div data-plane-body className="plane-body" aria-hidden="true">
      <svg data-part="wing-l" className="plane-panel plane-panel-l" viewBox="0 0 50 100" preserveAspectRatio="none">
        <polygon data-part="poly-l" points="50,0 0,0 0,100 50,100" />
        <g data-part="lines" className="plane-lines">
          {LINES.map((y, i) => (
            <line key={y} x1={i === 0 ? 10 : 8} x2="50" y1={y} y2={y} />
          ))}
        </g>
      </svg>
      <svg data-part="wing-r" className="plane-panel plane-panel-r" viewBox="0 0 50 100" preserveAspectRatio="none">
        <polygon data-part="poly-r" points="0,0 50,0 50,100 0,100" />
        <g data-part="lines" className="plane-lines">
          {LINES.map((y, i) => (
            <line key={y} x1="0" x2={i % 3 === 2 ? 30 : 42} y1={y} y2={y} />
          ))}
        </g>
      </svg>
      <svg data-part="keel" className="plane-keel" viewBox="0 0 12 100" preserveAspectRatio="none">
        <polygon points="6,0 12,100 0,100" />
      </svg>
    </div>
  );
}
