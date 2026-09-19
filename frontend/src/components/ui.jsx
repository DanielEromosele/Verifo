import { cn } from "../utils/cn";

export function Card({ className, children }) {
  return <div className={cn("rounded-xl border border-ink-100 bg-white shadow-card", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    ok: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-red-100 text-red-700",
    info: "bg-sky-100 text-sky-700",
    active: "bg-[#0056d2]/10 text-[#0056d2]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status) {
  const map = {
    VERIFIED: "ok",
    ACTIVE: "ok",
    COMPLETED: "ok",
    SUBMITTED: "info",
    PROCESSING: "info",
    RUNNING: "info",
    REVIEW: "warn",
    PENDING: "neutral",
    PARTIAL: "warn",
    FAILED: "bad",
    REJECTED: "bad",
    SUSPENDED: "bad",
    ARCHIVED: "neutral",
  };
  return map[status] || "neutral";
}

export function Progress({ value, className }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div className="h-full rounded-full bg-[#0056d2] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-ink-100 text-ink-500">{icon}</div>}
      <h3 className="text-sm font-bold text-ink-800">{title}</h3>
      {body && <p className="max-w-sm text-sm text-ink-600">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-100 border-t-[#0056d2]" />
      <span className="text-sm">{label || "Loading…"}</span>
    </div>
  );
}

export function ScoreRing({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const tone = v >= 80 ? "#16a34a" : v >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full text-lg font-bold text-ink-900"
        style={{
          background: `conic-gradient(${tone} ${v * 3.6}deg, #e8edf6 0deg)`,
        }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-bold text-ink-900">
          {Math.round(v)}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-800">Confidence score</p>
        <p className="text-xs text-ink-500">0–100 · human decision required</p>
      </div>
    </div>
  );
}