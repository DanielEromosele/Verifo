import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#0b2e59] lg:block">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(1100px 500px at 20% -10%, rgba(0,86,210,0.55), transparent 60%), radial-gradient(800px 400px at 90% 110%, rgba(0,200,160,0.28), transparent 55%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white ring-1 ring-white/25">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9.5 12h6M9.5 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Verifo</span>
          </Link>

          <div className="space-y-6">
            <h1 className="max-w-md text-3xl font-bold leading-tight text-white">
              Document verification you can defend.
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-blue-100/80">
              Upload a trusted original once, then screen every submission against it —
              with explainable scores, evidence, and an audit trail at every step.
            </p>
            <ul className="space-y-3 text-sm text-blue-100/90">
              {[
                "Reference-based comparison & fingerprinting",
                "Deterministic scoring, never a black box",
                "Operator-owned decisions with audit history",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-blue-200/60">Verifo — evidence-first verification platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-ink-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#0056d2] text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-ink-900">Verifo</span>
            </Link>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
          <div className="mt-8 space-y-5">{children}</div>
          <div className="mt-6 text-center text-sm text-ink-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}