import { createContext, useContext, useEffect } from "react";

import { api } from "../lib/api";
import { useAsync } from "../hooks/useAsync";

// Fetches the role's visible applications and shares them with both the sidebar
// (for live counts) and the dashboard (for the filtered list), so the list is
// fetched in one place and the counts and table never disagree.

const ApplicationsContext = createContext(undefined);

export function ApplicationsProvider({ children }) {
  const { data, error, loading, reload, setData } = useAsync(() => api.listApplications(), []);
  const applications = Array.isArray(data) ? data : data?.results ?? [];

  // Keep the list fresh when the tab regains focus — e.g. an applicant coming
  // back to their tab after a reviewer returned an application to them (which
  // sends it back to DRAFT). Refresh silently so the table doesn't flash a
  // loading state on every focus.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      api.listApplications().then(setData).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [setData]);

  return (
    <ApplicationsContext.Provider value={{ applications, error, loading, reload }}>
      {children}
    </ApplicationsContext.Provider>
  );
}

export function useApplications() {
  const ctx = useContext(ApplicationsContext);
  if (!ctx) {
    throw new Error("useApplications must be used within an ApplicationsProvider");
  }
  return ctx;
}
