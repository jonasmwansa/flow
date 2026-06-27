import { Navigate } from "react-router-dom";

import { useAuth } from "../context/auth";
import { AccessDenied } from "./AccessDenied";

/** Gate routes behind authentication and (optionally) a required role. */
export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-center text-gray-500">Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    // Wrong role for this area: show a clear "access denied" rather than a
    // silent redirect. (The API is the real guard — this is just matching UX.)
    return <AccessDenied requiredRole={role} />;
  }
  return children;
}
