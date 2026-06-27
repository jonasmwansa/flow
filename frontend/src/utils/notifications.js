// In-app notifications derived from the applications the user can already see —
// no extra backend call. The bell surfaces things that need the user's action:
// for an applicant, drafts to submit (an application returned for changes is back
// in DRAFT); for a reviewer, submissions waiting to be reviewed.

const APPLICANT_ACTIONS = {
  DRAFT: "is a draft — submit it when you’re ready",
};

export const STATUS_DOT = {
  DRAFT: "bg-gray-400",
  SUBMITTED: "bg-brand-500",
  UNDER_REVIEW: "bg-cyan-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
};

export function buildNotifications(role, applications) {
  if (role === "REVIEWER") {
    return applications
      .filter((a) => a.status === "SUBMITTED")
      .map((a) => ({
        id: a.id,
        appId: a.id,
        status: a.status,
        text: `“${a.title}” is awaiting your review.`,
      }));
  }
  return applications
    .filter((a) => APPLICANT_ACTIONS[a.status])
    .map((a) => ({
      id: a.id,
      appId: a.id,
      status: a.status,
      text: `“${a.title}” ${APPLICANT_ACTIONS[a.status]}.`,
    }));
}
