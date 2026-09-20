import { DashboardShell } from "../dashboard/_components/dashboard-shell";

// Every /features/* page renders inside the same shell as the dashboard, so the sidebar,
// theme switch and Settings button stay in place while moving between modules.
export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
