import { PageTransition } from "../_components/page-transition";

// A template (unlike a layout) remounts on every navigation, which replays the entrance animation.
export default function FeaturesTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
