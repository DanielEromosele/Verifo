import { cn } from "../utils/cn";

const STATUS_STYLES = {
  VERIFIED: "bg-brand-50 text-brand-700 border-brand-200",
  "REVIEW REQUIRED": "bg-warn-50 text-warn-600 border-warn-400/40",
  REVIEW: "bg-warn-50 text-warn-600 border-warn-400/40",
  FLAGGED: "bg-red-50 text-red-700 border-red-200",
  PROCESSING: "bg-ink-100 text-ink-600 border-ink-200",
  QUEUED: "bg-ink-100 text-ink-600 border-ink-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  PENDING: "bg-ink-100 text-ink-600 border-ink-200",
  ACTIVE: "bg-brand-50 text-brand-700 border-brand-200",
  SUSPENDED: "bg-warn-50 text-warn-600 border-warn-400/40",
  ARCHIVED: "bg-ink-100 text-ink-600 border-ink-200",
  MATCH: "bg-brand-50 text-brand-700 border-brand-200",
  MISMATCH: "bg-red-50 text-red-700 border-red-200",
  "NOT FOUND": "bg-warn-50 text-warn-600 border-warn-400/40",
  UNAVAILABLE: "bg-ink-100 text-ink-600 border-ink-200",
};

export default function StatusBadge({ status, className }) {
  const normalized = (status || "").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[normalized] || "bg-ink-50 text-ink-600 border-ink-200",
        className
      )}
    >
      {status}
    </span>
  );
}

export function Verified() {
  return <StatusBadge status="VERIFIED" />;
}
export function Flagged() {
  return <StatusBadge status="FLAGGED" />;
}
export function ReviewRequired() {
  return <StatusBadge status="REVIEW REQUIRED" />;
}