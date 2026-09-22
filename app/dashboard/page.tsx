import type { Metadata } from "next";
import { DashboardHome } from "./_components/dashboard-home";

export const metadata: Metadata = {
  title: "Overview · Shipping Doc Verifier",
};

export default function DashboardPage() {
  return <DashboardHome />;
}
