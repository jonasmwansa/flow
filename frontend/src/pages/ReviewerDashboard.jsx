import { Link, useLocation, useSearchParams } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useApplications } from "../context/applications-context";
import { formatAmount } from "../utils/format";
import { matchesView, resolveView } from "../utils/views";
import { alertError, btnSmOutline, card, link } from "../utils/ui";

export function ReviewerDashboard() {
  const { applications, loading, error } = useApplications();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const view = resolveView("REVIEWER", searchParams.get("view"));
  const visible = applications.filter((a) => matchesView(view, a));

  // Remember the current queue (view + search) so the detail page's "Back"
  // returns here instead of the role's default view.
  const from = location.pathname + location.search;

  const columns = [
    { key: "id", header: "#", sortValue: (r) => r.id },
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
    { key: "owner_email", header: "Applicant" },
    { key: "category", header: "Category" },
    {
      key: "amount",
      header: "Amount (ZMW)",
      sortValue: (r) => Number(r.amount) || 0,
      render: (r) => formatAmount(r.amount),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "open",
      header: "Action",
      sortable: false,
      render: (r) => (
        <Link to={`/applications/${r.id}`} state={{ from }} className={btnSmOutline}>
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={view.group} title={view.label} subtitle={view.description} />

      {loading && <p className="text-gray-500">Loading queue…</p>}
      {error && (
        <div className={alertError} role="alert">
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className={`${card} text-center text-gray-500`}>Nothing in this view right now.</div>
      )}

      {visible.length > 0 && (
        <div className={card}>
          <DataTable
            columns={columns}
            rows={visible}
            searchKeys={["title", "owner_email", "category"]}
            searchPlaceholder="Search queue…"
            initialSort={{ key: "id", dir: "asc" }}
          />
        </div>
      )}
    </div>
  );
}
