import { useState } from "react";

import { ApplicationsProvider } from "../context/applications-context";
import { useAuth } from "../context/auth";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const COLLAPSE_KEY = "flow_sidebar_collapsed";

export function Layout({ children }) {
  const { user } = useAuth();

  // Unauthenticated pages (login) get a plain centered shell — no chrome.
  if (!user) {
    return <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>;
  }

  return (
    <ApplicationsProvider>
      <AuthedShell>{children}</AuthedShell>
    </ApplicationsProvider>
  );
}

function AuthedShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // One button, two behaviours: on desktop it collapses the rail; on smaller
  // screens (where the sidebar is off-canvas) it opens the drawer.
  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((c) => {
        const next = !c;
        try {
          localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
        } catch {
          /* ignore storage errors */
        }
        return next;
      });
    } else {
      setDrawerOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 lg:flex">
      {/* Desktop sidebar — pinned; the toggle animates it open/collapsed. */}
      <aside
        aria-hidden={collapsed}
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none lg:block ${
          collapsed ? "w-0 opacity-0" : "w-72 opacity-100"
        }`}
      >
        <div
          className={`h-full w-72 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
            collapsed ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer — kept mounted so opening and closing can both animate. */}
      <div
        aria-hidden={!drawerOpen}
        className={`fixed inset-0 z-40 transition duration-300 ease-in-out motion-reduce:transition-none lg:hidden ${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`absolute inset-y-0 left-0 w-72 shadow-xl transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={toggleSidebar} />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
