// Sidebar navigation, organised by "whose turn it is". Each item maps to a set
// of workflow statuses; the dashboards filter the application list by the active
// item, and the sidebar shows a live count per item. `statuses: null` means
// "everything visible to this role".

export const VIEW_GROUPS = {
  APPLICANT: [
    {
      heading: "Your turn",
      icon: "user",
      items: [
        {
          key: "action-required",
          label: "Action Required",
          description: "Drafts — edit and submit",
          icon: "alert",
          accent: "amber",
          statuses: ["DRAFT"],
        },
      ],
    },
    {
      heading: "With the reviewer",
      icon: "users",
      items: [
        {
          key: "submitted",
          label: "Submitted",
          description: "Waiting to be picked up",
          icon: "clock",
          accent: "blue",
          statuses: ["SUBMITTED"],
        },
        {
          key: "under-review",
          label: "Being Reviewed",
          description: "A reviewer is on it",
          icon: "refresh",
          accent: "violet",
          statuses: ["UNDER_REVIEW"],
        },
      ],
    },
    {
      heading: "Applications",
      icon: "folder",
      items: [
        {
          key: "finished",
          label: "Finished",
          description: "Approved or rejected",
          icon: "check",
          accent: "green",
          statuses: ["APPROVED", "REJECTED"],
        },
        {
          key: "all",
          label: "All My Applications",
          description: "Everything you've created",
          icon: "list",
          accent: "slate",
          statuses: null,
        },
      ],
    },
  ],
  REVIEWER: [
    {
      heading: "Your turn",
      icon: "user",
      items: [
        {
          key: "to-review",
          label: "To Review",
          description: "New submissions waiting",
          icon: "inbox",
          accent: "blue",
          statuses: ["SUBMITTED"],
        },
        {
          key: "in-progress",
          label: "In Progress",
          description: "Reviews you've started",
          icon: "refresh",
          accent: "violet",
          statuses: ["UNDER_REVIEW"],
        },
      ],
    },
    {
      heading: "Applications",
      icon: "folder",
      items: [
        {
          key: "finished",
          label: "Finished",
          description: "Approved or rejected",
          icon: "check",
          accent: "green",
          statuses: ["APPROVED", "REJECTED"],
        },
        {
          key: "all",
          label: "All Applications",
          description: "Everything in the queue",
          icon: "list",
          accent: "slate",
          statuses: null,
        },
      ],
    },
  ],
};

export const DEFAULT_VIEW = { APPLICANT: "action-required", REVIEWER: "to-review" };

export function groupsForRole(role) {
  return VIEW_GROUPS[role] ?? VIEW_GROUPS.APPLICANT;
}

function flatItems(role) {
  // Carry each item's group heading along so callers can label the page by the
  // section it lives under (e.g. "Applications", "With the applicant").
  return groupsForRole(role).flatMap((g) =>
    g.items.map((item) => ({ ...item, group: g.heading })),
  );
}

/** Resolve a view key (from the URL) to its config, falling back to the default. */
export function resolveView(role, key) {
  const items = flatItems(role);
  return (
    items.find((i) => i.key === key) ||
    items.find((i) => i.key === DEFAULT_VIEW[role]) ||
    items[0]
  );
}

/** Does an application belong in this view? */
export function matchesView(view, app) {
  return !view.statuses || view.statuses.includes(app.status);
}
