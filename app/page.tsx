import { MarketingNav } from "./_components/marketing-nav";
import { SceneCompare } from "./_components/landing/scene-compare";
import { SceneFold } from "./_components/landing/scene-fold";
import { SceneHandoff } from "./_components/landing/scene-handoff";
import { SceneInbox } from "./_components/landing/scene-inbox";
import { SceneLanding } from "./_components/landing/scene-landing";
import { SceneScanner } from "./_components/landing/scene-scanner";
import { SceneWorkspace } from "./_components/landing/scene-workspace";
import { PlaneLayerLazy } from "./_components/scroll/plane-layer-lazy";
import { ScrollProvider } from "./_components/scroll/scroll-provider";

/**
 * Landing page: a scroll-driven story in seven scenes (see docs/LANDING_REDESIGN_PROMPT.md).
 * All text is server-rendered in the initial HTML; the plane and the scroll choreography are
 * client-side enhancements on top of an ordinary vertical page.
 */
export default function LandingPage() {
  return (
    <ScrollProvider>
      <div className="text-fg">
        <MarketingNav />
        <SceneFold />
        <SceneInbox />
        <SceneScanner />
        <SceneCompare />
        <SceneHandoff />
        <SceneWorkspace />
        <SceneLanding />
      </div>
      <PlaneLayerLazy />
    </ScrollProvider>
  );
}
