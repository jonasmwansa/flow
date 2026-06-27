import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApplications } from "../context/applications-context";
import { useAuth } from "../context/auth";
import { buildNotifications, STATUS_DOT } from "../utils/notifications";
import { Icon } from "./icons";

export function TopBar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { applications } = useApplications();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null); // "notif" | "profile" | null
  const cluster = useRef(null);

  const notifications = buildNotifications(user.role, applications);
  const roleLabel = user.role === "REVIEWER" ? "Reviewer" : "Applicant";

  // Close any open dropdown when clicking outside the right-hand cluster.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => {
      if (cluster.current && !cluster.current.contains(e.target)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const close = () => setMenu(null);
  const handleLogout = () => {
    close();
    logout();
    navigate("/login", { replace: true });
  };
  const openApp = (id) => {
    close();
    navigate(`/applications/${id}`);
  };

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        aria-label="Toggle sidebar"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div ref={cluster} className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "notif" ? null : "notif")}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            aria-label={`Notifications (${notifications.length})`}
          >
            <Icon name="bell" className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>
          {menu === "notif" && (
            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                Notifications
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">You’re all caught up.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openApp(n.appId)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            STATUS_DOT[n.status] ?? "bg-gray-400"
                          }`}
                        />
                        <span className="text-sm text-gray-700">{n.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "profile" ? null : "profile")}
            className="flex items-center gap-2 rounded-lg border border-gray-200 py-1 pl-1 pr-2 hover:bg-gray-50"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-semibold uppercase text-white">
              {user.email[0]}
            </span>
            <span className="hidden text-sm font-medium text-gray-700 sm:block">{user.email}</span>
            <Icon name="chevron" className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>
          {menu === "profile" && (
            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-semibold">{user.email}</p>
                <p className="text-xs text-gray-500">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon name="logout" className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
