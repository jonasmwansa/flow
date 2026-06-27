import { Link } from "react-router-dom";

import { useAuth } from "../context/auth";
import { btnPrimary, btnSecondary, card } from "../utils/ui";

const ROLE_LABEL = { APPLICANT: "applicants", REVIEWER: "reviewers" };
const ROLE_LABEL_ONE = { APPLICANT: "an applicant", REVIEWER: "a reviewer" };

// Shown when a signed-in user opens a route meant for the other role (e.g. a
// reviewer navigating to /applicant). The API enforces roles for real; this is
// the matching, visible UX so the separation isn't a silent redirect.
export function AccessDenied({ requiredRole }) {
  const { user, logout } = useAuth();
  const home = user.role === "REVIEWER" ? "/reviewer" : "/applicant";

  return (
    <div className="mx-auto max-w-lg">
      <div className={`${card} text-center`}>
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
          Access denied
        </p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">
          This area is for {ROLE_LABEL[requiredRole]}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          You’re signed in as {ROLE_LABEL_ONE[user.role]} ({user.email}), so you
          can’t open the {ROLE_LABEL[requiredRole].slice(0, -1)} workspace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={home} className={btnPrimary}>
            Go to my dashboard
          </Link>
          <button type="button" onClick={logout} className={btnSecondary}>
            Sign in as someone else
          </button>
        </div>
      </div>
    </div>
  );
}
