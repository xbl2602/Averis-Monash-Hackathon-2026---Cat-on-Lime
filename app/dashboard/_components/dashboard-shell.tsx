"use client";

import { useState, type ReactNode } from "react";
import { SearchProvider } from "./search-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SearchProvider>
      <div className="min-h-screen bg-ink text-white lg:flex">
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        {sidebarOpen && (
          <button
            type="button"
            aria-label="关闭侧边栏"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-ink/70 backdrop-blur-sm lg:hidden"
          />
        )}

        <div className="min-w-0 flex-1">
          <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <main className="px-4 py-8 sm:px-8 lg:px-10">{children}</main>
        </div>
      </div>
    </SearchProvider>
  );
}
