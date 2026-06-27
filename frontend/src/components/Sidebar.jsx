import { Link, useLocation, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/auth";
import { ACCENTS } from "../utils/ui";
import { DEFAULT_VIEW, groupsForRole } from "../utils/views";
import { Icon } from "./icons";

export function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();

  const role = user.role;
  const base = role === "REVIEWER" ? "/reviewer" : "/applicant";
  const onDashboard = location.pathname === base;
  const creating = onDashboard && params.get("new") === "1";
  const activeKey = onDashboard && !creating ? params.get("view") || DEFAULT_VIEW[role] : null;
  const groups = groupsForRole(role);

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
          <Icon name="grid" />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold text-gray-900">Flow</p>
          <p className="text-xs text-gray-400">Submission &amp; Approval</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Icon name={group.icon} className="h-3.5 w-3.5" />
                {group.heading}
              </span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.key === activeKey;
                const accent = ACCENTS[item.accent] ?? ACCENTS.slate;
                return (
                  <li key={item.key}>
                    <Link
                      to={`${base}?view=${item.key}`}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-start gap-3 rounded-lg px-2.5 py-2 transition ${
                        active ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${accent.tile}`}
                      >
                        <Icon name={item.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-semibold ${
                            active ? "text-brand-700" : "text-gray-700"
                          }`}
                        >
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-gray-400">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Workspace / user card */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold uppercase text-white">
            {user.email[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-800">{user.email}</p>
            <p className="text-xs text-gray-400">
              {role === "REVIEWER" ? "Reviewer" : "Applicant"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
