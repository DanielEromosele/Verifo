import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-ink-50">
      <TopNav />
      <Hero />
      <RoleGrid />
      <HowItWorks />
      <Security />
      <CtaBand />
      <Footer />
    </div>
  );
}

function BrandMark({ dark = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${dark ? "bg-ink-900 text-brand-300" : "bg-ink-900 text-brand-300"}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 12h6M9.5 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-ink-900">Verifo</p>
        <p className="text-[11px] text-ink-500">Document Verification</p>
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <header className="border-b border-ink-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <BrandMark />
        <Link to="/dashboard" className="btn-primary">
          Open workspace
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center lg:pt-28">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3.5 py-1 text-xs font-semibold text-ink-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Evidence-based document verification
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
          Prove a document is real.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600">
          Verifo lets issuers publish verifiable references and lets anyone confirm a
          document against them — with scored evidence, a full audit trail, and no
          guesswork.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className="btn-primary px-7 py-3 text-base">
            Launch the demo
          </Link>
          <a href="#how-it-works" className="btn-secondary px-7 py-3 text-base">
            See how it works
          </a>
        </div>
        <p className="mt-6 text-xs text-ink-500">
          The demo opens directly into an admin workspace — no account needed.
        </p>
      </div>
    </section>
  );
}

const ROLES = [
  {
    title: "For Issuers",
    icon: "M19 14l-7 7-7-7m7-6v13",
    points: ["Publish reference documents for verification", "Set per-document verification config", "Full audit trail of every check"],
  },
  {
    title: "For Operators",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    points: ["Single and bulk verification workflows", "Confidence scoring with detailed evidence", "Human decision stays in control"],
  },
  {
    title: "For Verifiers",
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    points: ["Instantly check a document against its issuer", "Clear traits: verified, review, failed", "No dependencies on third-party claims"],
  },
];

function RoleGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-5 lg:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.title} className="card p-7">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d={r.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink-900">{r.title}</h3>
            <ul className="mt-3 space-y-2.5">
              {r.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-ink-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Issue & publish references", body: "Issuers upload reference documents for the records they hand out — sealed behind their own tenant." },
  { n: "02", title: "A document arrives", body: "A verifier submits a document, image, or archive along with the reference it claims to match." },
  { n: "03", title: "Multi-signal analysis", body: "OCR, issuer records, reference comparison, and integrity checks each produce an independent score." },
  { n: "04", title: "Operator decides", body: "A human operator reviews the scored evidence and records the final outcome. Decisions are never taken by the machine alone." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-ink-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">How it works</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-ink-900">
          From reference to verified outcome — with evidence at every step.
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <p className="text-4xl font-black text-ink-100">{s.n}</p>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SECURITY = [
  { title: "Tenant isolation", body: "Every organization operates behind its own data boundary. Cross-organization access is blocked server-side." },
  { title: "Full audit trail", body: "Every check, every operator decision, and every config change is recorded, append-only." },
  { title: "Evidence, not verdicts", body: "Scored signals and transparent thresholds — reflection of analysis, never vague AI guarantees." },
  { title: "Encrypted at rest", body: "Stored documents are encrypted with per-deployment keys, and download links expire." },
];

function Security() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Trust model</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-ink-900">
        Verification you can explain to anyone.
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {SECURITY.map((s) => (
          <div key={s.title} className="card p-6">
            <h3 className="text-base font-bold text-ink-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="rounded-2xl bg-ink-900 px-8 py-12 text-center sm:px-14">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Start verifying with confidence.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-300">
          Create your organization workspace in under a minute and publish your
          first references.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className="btn-primary px-7 py-3 text-base">
            Open your workspace
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
        <BrandMark />
        <p className="text-xs text-ink-500">
          © {new Date().getFullYear()} Verifo · Document verification, made explainable.
        </p>
      </div>
    </footer>
  );
}