import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { ApiError, api } from "../lib/api";
import { confirmAction, showError, toastSuccess } from "../utils/alerts";
import { ApplicationForm } from "../components/ApplicationForm";
import { DataTable } from "../components/DataTable";
import { Icon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useApplications } from "../context/applications-context";
import { matchesView, resolveView } from "../utils/views";
import { alertError, btnPrimary, btnSmOutline, btnSmPrimary, card, link } from "../utils/ui";

const BASE = "/applicant";

export function ApplicantDashboard() {
  const { applications, loading, error, reload } = useApplications();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [busyId, setBusyId] = useState(null);

  const creating = searchParams.get("new") === "1";
  const view = resolveView("APPLICANT", searchParams.get("view"));
  const visible = applications.filter((a) => matchesView(view, a));

  // Remember the current view (view + search) so the detail page's "Back"
  // returns here instead of the role's default view.
  const from = location.pathname + location.search;

  const closeForm = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async (values) => {
    await api.createApplication(values);
    closeForm();
    reload();
    toastSuccess("Draft created.");
  };

  const handleSubmitApplication = async (app) => {
    const ok = await confirmAction({
      title: "Submit for review?",
      text: "You won’t be able to edit once you submit.",
      confirmText: "Yes, submit",
    });
    if (!ok) return;
    setBusyId(app.id);
    try {
      await api.transition(app.id, "submit");
      reload();
      toastSuccess("Submitted for review.");
    } catch (err) {
      showError("Could not submit", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "title",
      header: "Title",
      sortValue: (r) => r.title,
      render: (r) => (
        <Link to={`/applications/${r.id}`} state={{ from }} className={link}>
          {r.title}
        </Link>
      ),
    },
    { key: "category", header: "Category" },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => {
        const editable = r.status === "DRAFT";
        return (
          <div className="flex flex-wrap gap-2">
            <Link to={`/applications/${r.id}`} state={{ from }} className={btnSmOutline}>
              Open
            </Link>
            {editable && (
              <button
                type="button"
                className={btnSmPrimary}
                disabled={busyId === r.id}
                onClick={() => handleSubmitApplication(r)}
              >
                {busyId === r.id ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={creating ? "My workspace" : view.group}
        title={creating ? "New application" : view.label}
        subtitle={creating ? "Create a draft you can edit before submitting." : view.description}
        actions={
          !creating && (
            <Link to={`${BASE}?new=1`} className={btnPrimary}>
              <Icon name="plus" className="h-4 w-4" />
              New Application
            </Link>
          )
        }
      />

      {creating && (
        <div className={card}>
          <ApplicationForm
            submitLabel="Create draft"
            onSubmit={handleCreate}
            onCancel={closeForm}
            confirm={() =>
              confirmAction({
                title: "Create this draft?",
                text: "You can keep editing it before submitting.",
                confirmText: "Create draft",
              })
            }
          />
        </div>
      )}

      {loading && <p className="text-gray-500">Loading your applications…</p>}
      {error && (
        <div className={alertError} role="alert">
          {error}
        </div>
      )}

      {!creating && !loading && !error && visible.length === 0 && (
        <div className={`${card} text-center text-gray-500`}>
          {applications.length === 0
            ? "You have no applications yet. Start one with “New Application”."
            : "Nothing in this view right now."}
        </div>
      )}

      {!creating && visible.length > 0 && (
        <div className={card}>
          <DataTable
            columns={columns}
            rows={visible}
            searchKeys={["title", "category"]}
            searchPlaceholder="Search applications…"
          />
        </div>
      )}
    </div>
  );
}
