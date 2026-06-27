import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/auth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ApplicantDashboard } from "./pages/ApplicantDashboard";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewerDashboard } from "./pages/ReviewerDashboard";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-center text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "REVIEWER" ? "/reviewer" : "/applicant"} replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/applicant"
          element={
            <ProtectedRoute role="APPLICANT">
              <ApplicantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviewer"
          element={
            <ProtectedRoute role="REVIEWER">
              <ReviewerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/:id"
          element={
            <ProtectedRoute>
              <ApplicationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Layout>
  );
}
