"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

// Shared app shell: the dashboard, every /features/* page and the settings page all render inside it,
// so the sidebar (and its Settings button) is always there.
export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page text-fg lg:flex">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="min-w-0 flex-1">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
