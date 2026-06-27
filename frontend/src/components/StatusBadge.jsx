import { STATUS_LABELS } from "../utils/types";

// Map each workflow status to a Tailwind badge colour.
const BADGE_CLASS = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-cyan-100 text-cyan-800",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
        BADGE_CLASS[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
