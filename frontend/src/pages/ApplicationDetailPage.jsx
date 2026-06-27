import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, api } from "../lib/api";
import { confirmAction, showError, toastSuccess } from "../utils/alerts";
import { ApplicationForm } from "../components/ApplicationForm";
import { BottomSheet } from "../components/BottomSheet";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { useApplications } from "../context/applications-context";
import { useAuth } from "../context/auth";
import { formatAmount } from "../utils/format";
import { useAsync } from "../hooks/useAsync";
import { STATUS_LABELS } from "../utils/types";
import {
  alertError,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  input,
  label,
  link,
} from "../utils/ui";

const FIELD_LABELS = {
  title: "Title",
  category: "Category",
  description: "Description",
  amount: "Amount",
  attachment: "Attachment",
};

// The "Change" cell: a status transition (old → new) or, for an edit event,
// the per-field diff recorded in `changes`.
function renderChange(r) {
  const changes = r.changes && Object.keys(r.changes).length > 0 ? r.changes : null;
  if (!changes) {
    return `${STATUS_LABELS[r.old_status]} → ${STATUS_LABELS[r.new_status]}`;
  }
  return (
    <div>
      <span className="font-medium text-gray-700">Edited</span>
      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
        {Object.entries(changes).map(([field, [from, to]]) => {
          const fmt = (v) => (field === "amount" ? formatAmount(v) : v || "—");
          return (
            <li key={field}>
              <span className="text-gray-500">{FIELD_LABELS[field] ?? field}:</span>{" "}
              <span className="text-gray-400 line-through">{fmt(from)}</span>
              {" → "}
              <span>{fmt(to)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const AUDIT_COLUMNS = [
  {
    key: "created_at",
    header: "When",
    sortValue: (r) => r.created_at,
    render: (r) => new Date(r.created_at).toLocaleString(),
  },
  { key: "actor_email", header: "Actor", render: (r) => r.actor_email ?? "—" },
  {
    key: "change",
    header: "Change",
    sortable: false,
    render: renderChange,
  },
  {
    key: "comment",
    header: "Comment",
    sortable: false,
    render: (r) => r.comment || <span className="text-gray-500">—</span>,
  },
];

// Confirmation copy + success message per workflow action.
const CONFIRM = {
  submit: {
    title: "Submit for review?",
    text: "You won’t be able to edit once you submit.",
    confirmText: "Yes, submit",
  },
  "start-review": {
    title: "Start review?",
    text: "This moves the application to Under review.",
    confirmText: "Start review",
  },
  approve: {
    title: "Approve this application?",
    text: "This marks it approved — the applicant will be notified.",
    confirmText: "Approve",
  },
  reject: {
    title: "Reject this application?",
    text: "The applicant will see your comment.",
    confirmText: "Reject",
    danger: true,
  },
  return: {
    title: "Return for changes?",
    text: "The applicant can edit and resubmit.",
    confirmText: "Return",
  },
};

const SUCCESS = {
  submit: "Submitted for review.",
  "start-review": "Review started.",
  approve: "Application approved.",
  reject: "Application rejected.",
  return: "Returned for changes.",
};

// Reviewer decisions that require a comment are captured via the slide-up modal.
const REVIEW_ACTIONS = {
  reject: {
    title: "Reject application",
    confirmText: "Reject",
    danger: true,
    commentRequired: true,
    commentLabel: "Reason for rejection (required)",
  },
  return: {
    title: "Return for changes",
    confirmText: "Return",
    danger: false,
    commentRequired: true,
    commentLabel: "What needs changing? (required)",
  },
};

export function ApplicationDetailPage() {
  const { id } = useParams();
  const appId = Number(id);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { reload: reloadList } = useApplications();
  const { data: app, error, loading, reload } = useAsync(
    () => api.getApplication(appId),
    [appId],
  );

  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(null);
  const [reviewAction, setReviewAction] = useState(null); // "reject" | "return" | null
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  if (loading) return <p className="text-gray-500">Loading application…</p>;
  if (error) return <div className={alertError} role="alert">{error}</div>;
  if (!app || !user) return null;

  const isOwner = user.id === app.owner;
  const isApplicant = user.role === "APPLICANT";
  const isReviewer = user.role === "REVIEWER";
  const editable = app.status === "DRAFT";

  // Simple transitions with no comment (submit, start review, approve) — confirm via SweetAlert.
  const runTransition = async (action) => {
    const ok = await confirmAction(CONFIRM[action]);
    if (!ok) return;
    setBusy(action);
    try {
      await api.transition(appId, action);
      reload();
      reloadList();
      toastSuccess(SUCCESS[action]);
    } catch (err) {
      showError("Action failed", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  // Reject/return decisions — captured in the slide-up modal (the modal is the confirm step).
  const openReview = (action) => {
    setComment("");
    setReviewAction(action);
  };
  const closeReview = () => {
    setReviewAction(null);
    setComment("");
  };
  const submitReview = async () => {
    const cfg = REVIEW_ACTIONS[reviewAction];
    const trimmed = comment.trim();
    if (cfg.commentRequired && !trimmed) return;
    if (reviewAction === "reject" || reviewAction === "return") {
      const ok = await confirmAction(CONFIRM[reviewAction]);
      if (!ok) return;
    }
    const action = reviewAction;
    setBusy(action);
    try {
      await api.transition(appId, action, trimmed || undefined);
      reloadList();
      toastSuccess(SUCCESS[action]);
      closeReview();
      // "Return" sends the application back to DRAFT, which a reviewer can no
      // longer see — go back to the queue instead of reloading into a 404.
      if (action === "return") {
        navigate(location.state?.from ?? "/reviewer");
      } else {
        reload();
      }
    } catch (err) {
      showError("Action failed", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleEditSave = async (values) => {
    await api.updateApplication(appId, values);
    setEditing(false);
    reload();
    reloadList();
    toastSuccess("Changes saved.");
  };

  // Return to the exact queue/view the user came from (carried via Link state);
  // fall back to the role's root for direct/deep links where there's no history.
  const backHref = location.state?.from ?? (isReviewer ? "/reviewer" : "/applicant");
  const actionHint =
    isReviewer && app.status === "SUBMITTED"
      ? "Move this submission into review before deciding."
      : isReviewer && app.status === "UNDER_REVIEW"
        ? "Choose an outcome after inspecting the application."
        : isApplicant && isOwner && editable
          ? "Edit the draft or submit it for review."
          : "";
  // Only show the Action card when the viewer can actually do something; the
  // status badge already communicates "nothing to do here" on its own.
  const canApplicantAct = isApplicant && isOwner && editable;
  const canReviewerAct =
    isReviewer && (app.status === "SUBMITTED" || app.status === "UNDER_REVIEW");
  const showActionCard = canApplicantAct || canReviewerAct;
  const attachmentName = app.attachment_name ?? "Attachment";
  const attachmentRef = `${attachmentName} ${app.attachment_url ?? ""}`;
  const attachmentIsImage = /\.(png|jpe?g|webp)(\?|$|\s)/i.test(attachmentRef);
  const attachmentIsPdf = /\.pdf(\?|$|\s)/i.test(attachmentRef);

  return (
    <div className="space-y-4">
      <div>
        <Link to={backHref} className={link}>
          ← Back
        </Link>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 break-words text-xl font-bold">{app.title}</h1>
          <StatusBadge status={app.status} />
        </div>

        {!editing && showActionCard && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </p>
                {actionHint && (
                  <p className="mt-1 text-sm text-gray-600">{actionHint}</p>
                )}
              </div>

              {isApplicant && isOwner && editable && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnSecondary} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy === "submit"}
                    onClick={() => runTransition("submit")}
                  >
                    {busy === "submit" ? "Submitting…" : "Submit for review"}
                  </button>
                </div>
              )}

              {isReviewer && app.status === "SUBMITTED" && (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy === "start-review"}
                  onClick={() => runTransition("start-review")}
                >
                  {busy === "start-review" ? "Starting…" : "Start review"}
                </button>
              )}

              {isReviewer && app.status === "UNDER_REVIEW" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy === "approve"}
                    onClick={() => runTransition("approve")}
                  >
                    {busy === "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button type="button" className={btnDanger} onClick={() => openReview("reject")}>
                    Reject
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => openReview("return")}>
                    Return for changes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {editing ? (
          <div className="mt-4">
            <ApplicationForm
              initial={app}
              submitLabel="Save changes"
              onSubmit={handleEditSave}
              onCancel={() => setEditing(false)}
              confirm={() =>
                confirmAction({
                  title: "Save changes?",
                  confirmText: "Save changes",
                })
              }
            />
          </div>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [&>dd]:break-words">
              <dt className="text-gray-500">Category</dt>
              <dd>{app.category}</dd>
              <dt className="text-gray-500">Amount (ZMW)</dt>
              <dd>{formatAmount(app.amount)}</dd>
              <dt className="text-gray-500">Applicant</dt>
              <dd>{app.owner_email}</dd>
              <dt className="text-gray-500">Description</dt>
              <dd>{app.description || <span className="text-gray-500">No description.</span>}</dd>
            </dl>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Attachment</p>
                  {!app.attachment_url && (
                    <p className="mt-1 text-sm text-gray-700">No attachment.</p>
                  )}
                </div>
                {app.attachment_url && (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setAttachmentOpen((open) => !open)}
                    aria-expanded={attachmentOpen}
                    aria-controls="application-attachment-panel"
                  >
                    {attachmentOpen ? "Hide attachment" : "Show attachment"}
                  </button>
                )}
              </div>

              {app.attachment_url && attachmentOpen && (
                <div
                  id="application-attachment-panel"
                  className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  {attachmentIsImage && (
                    <div className="bg-white p-3">
                      <img
                        src={app.attachment_url}
                        alt={attachmentName}
                        className="max-h-[28rem] w-full rounded-lg object-contain"
                      />
                    </div>
                  )}

                  {attachmentIsPdf && (
                    <div className="bg-white p-4">
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                        <p className="text-sm font-semibold text-gray-800">PDF attachment</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Open the file in a new tab to preview or download it.
                        </p>
                        <a
                          href={app.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                        >
                          Open PDF
                        </a>
                      </div>
                    </div>
                  )}

                  {!attachmentIsImage && !attachmentIsPdf && (
                    <p className="p-3 text-sm text-gray-500">
                      Preview is not available for this file type. Use Open file to view it.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* --- Audit trail --- */}
      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">Audit trail</h2>
        {app.audit_logs && app.audit_logs.length > 0 ? (
          <DataTable
            columns={AUDIT_COLUMNS}
            rows={app.audit_logs}
            searchKeys={["actor_email", "comment"]}
            searchPlaceholder="Search audit trail…"
            initialSort={{ key: "created_at", dir: "asc" }}
          />
        ) : (
          <p className="text-gray-500">No transitions yet.</p>
        )}
      </div>

      <BottomSheet
        open={!!reviewAction}
        onClose={closeReview}
        title={reviewAction ? REVIEW_ACTIONS[reviewAction].title : ""}
      >
        {reviewAction && (
          <div className="space-y-4">
            <div>
              <label htmlFor="review-comment" className={label}>
                {REVIEW_ACTIONS[reviewAction].commentLabel}
              </label>
              <textarea
                id="review-comment"
                className={input}
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain your decision…"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={closeReview}>
                Cancel
              </button>
              <button
                type="button"
                className={REVIEW_ACTIONS[reviewAction].danger ? btnDanger : btnPrimary}
                disabled={
                  busy === reviewAction ||
                  (REVIEW_ACTIONS[reviewAction].commentRequired && !comment.trim())
                }
                onClick={submitReview}
              >
                {busy === reviewAction ? "Working…" : REVIEW_ACTIONS[reviewAction].confirmText}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
