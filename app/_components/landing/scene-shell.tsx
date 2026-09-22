import type { CSSProperties, ReactNode, Ref } from "react";
import { BUILD } from "../scroll/scene-config";

/**
 * Frame shared by the pinned scenes: a tall wrapper holding one sticky 100vh stage.
 * The wrapper's height comes from `pin` (see globals.css `.scene`); in the plain document it is
 * just a section. Children are the text column and the visual column (a 12-column grid on desktop).
 */
export function SceneShell({
  id,
  pin,
  jump = (pin * BUILD) / 100,
  ref,
  children,
}: {
  id: string;
  pin: number;
  /**
   * Anchor links land this far (in viewport heights) into the scene. The default is the moment the scene
   * has finished building, so a menu click shows the whole scene, not a half-drawn one.
   */
  jump?: number;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section id={id} ref={ref} data-jump={jump} style={{ "--pin": pin } as CSSProperties} className="scene">
      <div className="scene-stage">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-1 items-center gap-10 px-5 py-16 sm:px-8 story:grid-cols-12 story:gap-10 story:py-0">
          {children}
        </div>
      </div>
    </section>
  );
}

/** Small mono label + optional heading used at the top of a scene's copy */
export function SceneEyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
