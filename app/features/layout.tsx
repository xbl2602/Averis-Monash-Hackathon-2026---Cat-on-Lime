import { Nav } from "../core/nav";

// 只包住 /features/* 下的页面，保留原来那条简洁的顶部导航，
// 这样 classification/extraction/comparison/verification/jev-lab 这些页面不用改一行就继续能用。
export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
