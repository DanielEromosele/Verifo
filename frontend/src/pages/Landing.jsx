import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SANS = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div
      className="min-h-screen bg-white text-slate-900 antialiased"
      style={{ fontFamily: SANS }}
    >
      <Header />
      <main className="w-full pt-28">
        <Hero />
        <TrustStrip />
        <Comparator />
        <Engine />
        <OperatorDesk />
        <SecuritySection />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

function Brand({ size = "h-7", dark = false }) {
  return (
    <div className={`grid ${size} aspect-square place-items-center rounded-xl text-white ${dark ? "bg-slate-800" : "bg-violet-600"}`}>
      <svg width="70%" height="70%" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9.5 12h6M9.5 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-300">
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <div className="flex items-center justify-between rounded-full border border-slate-200/70 bg-white/80 px-6 py-3 shadow-sm backdrop-blur-xl">
          <Link to="/" className="flex shrink-0 items-center gap-2 group">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-8 text-[14px] font-medium text-slate-600 md:flex">
            <a className="transition-colors hover:text-violet-600" href="#product">Product</a>
            <a className="transition-colors hover:text-violet-600" href="#how-it-works">How It Works</a>
            <a className="transition-colors hover:text-violet-600" href="#operator-desk">Operator Desk</a>
            <a className="transition-colors hover:text-violet-600" href="#security">Security &amp; API</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="hidden px-3 py-1.5 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex" to="/login">
              Sign In
            </Link>
            <Link className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-[13px] font-semibold tracking-wide text-white shadow-sm shadow-violet-500/10 transition-all hover:bg-violet-700 hover:shadow-violet-500/25" to="/register">
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function Icon({ name, className = "text-[20px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function Hero() {
  return (
    <section id="product" className="relative overflow-hidden pb-24 pt-12 lg:pb-32 lg:pt-20">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-100/60 via-violet-50/30 to-transparent blur-3xl"></div>
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50 px-3.5 py-1 shadow-[0_2px_10px_rgba(124,58,237,0.06)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600"></span>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-violet-700">
            AI-Assisted Credential Verification
          </span>
        </div>

        <h1 className="mb-6 text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
          Verify Documents{" "}
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            With Evidence.
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg font-normal leading-relaxed text-slate-600 sm:text-xl">
          Compare submitted documents against trusted references, institutional records, and integrity signals — all in one calibrated workflow.
        </p>

        <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
          <Link className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-7 py-3.5 text-[15px] font-medium text-white shadow-md shadow-violet-600/20 transition-all hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-600/30" to="/register">
            <span>Start Verifying</span>
            <Icon name="arrow_forward" className="text-[18px]" />
          </Link>
          <a className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-100 px-7 py-3.5 text-[15px] font-medium text-slate-800 transition-all hover:bg-slate-200/70" href="#how-it-works">
            <Icon name="play_circle" className="text-[20px] text-violet-600" />
            <span>See How It Works</span>
          </a>
        </div>

        <PipelineShowcase />
      </div>
    </section>
  );
}

function PipelineShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-4 text-left shadow-2xl purple-glow sm:p-7">
      <style>{`.purple-glow { box-shadow: 0 20px 60px -15px rgba(124,58,237,0.15); }`}</style>
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-slate-200"></span>
          <span className="h-3 w-3 rounded-full bg-slate-200"></span>
          <span className="h-3 w-3 rounded-full bg-slate-200"></span>
          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pipeline Monitor • Academic Transcript Intake
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-0.5 text-xs font-semibold text-violet-700">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-600"></span>
          LIVE SYNTHESIS
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
        <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">01 / Input Payload</span>
              <span className="font-mono text-[11px] text-slate-400">PDF • 2.4MB</span>
            </div>
            <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Icon name="school" className="text-[18px] text-violet-600" />
                <div className="truncate text-xs font-semibold text-slate-800">Official Academic Transcript</div>
              </div>
              <div className="space-y-1.5 opacity-60">
                <div className="h-2 w-3/4 rounded bg-slate-200"></div>
                <div className="h-2 w-full rounded bg-slate-100"></div>
                <div className="h-2 w-5/6 rounded bg-slate-200"></div>
              </div>
              <div className="flex items-center justify-between pt-2 font-mono text-[10px] text-slate-400">
                <span>ID: #UG-9042</span>
                <span className="font-semibold text-violet-600">256-BIT CHECKSUM</span>
              </div>
            </div>
            <div className="text-[12px] leading-snug text-slate-500">
              Calibrated spatial mapping completed across 14 credential anchors.
            </div>
          </div>
        </div>

        <div className="space-y-2.5 md:col-span-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center gap-2.5">
              <Icon name="account_balance" className="text-[20px] text-violet-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Reference Match</div>
                <div className="text-[11px] text-slate-500">Master Template 2024</div>
              </div>
            </div>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">94.2%</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center gap-2.5">
              <Icon name="database" className="text-[20px] text-emerald-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Database Record</div>
                <div className="text-[11px] text-slate-500">Registrar SIS Registry</div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">100%</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
            <div className="flex items-center gap-2.5">
              <Icon name="warning" className="text-[20px] text-amber-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Integrity Scanner</div>
                <div className="text-[11px] text-amber-700">Seal Opacity Variance</div>
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Flagged</span>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between rounded-2xl border border-violet-100 bg-violet-50/50 p-4 sm:p-5 md:col-span-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">Evidentiary Weight</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">REVIEW REQUIRED</span>
            </div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-slate-950">92%</span>
              <span className="text-xs text-slate-500">Confidence Score</span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-600">
              Metadata producer variance flagged. Human determination required before issuance clearance.
            </p>
          </div>
          <Link className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-700" to="/dashboard">
            <Icon name="assignment_ind" className="text-[16px]" />
            <span>Open the Operator Desk</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = [
    { icon: "account_balance", title: "Universities", sub: "Academic Records" },
    { icon: "payments", title: "Tier-1 Banks", sub: "AML & Affidavits" },
    { icon: "local_hospital", title: "Teaching Hospitals", sub: "Practicing Licenses" },
    { icon: "assured_workload", title: "Gov Registries", sub: "Sovereign Identifiers" },
  ];
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Trusted Attestation Across Continental &amp; Global Rails
        </p>
        <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          {items.map((it) => (
            <div key={it.title} className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
              <Icon name={it.icon} className="text-2xl text-violet-600" />
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">{it.title}</div>
                <div className="text-[11px] text-slate-500">{it.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparator() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-violet-600">Evidentiary Distinction</span>
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Matching the name isn't enough.
        </h2>
        <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
          A counterfeit document can contain the correct name, matriculation ID, and cloned signatures. Genuine trust requires multi-layer forensic evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Document A • Trusted Reference</span>
              </div>
              <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">ISSUER MASTER MATRIX</span>
            </div>
            <h3 className="mb-1 text-xl font-bold text-slate-900">University Master Archive</h3>
            <p className="mb-6 text-xs text-slate-500">Standard Academic Matrix • Calibrated 2024 Template</p>
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 font-mono text-xs text-slate-600">
              <div className="flex justify-between"><span>SEAL OPACITY:</span><span className="font-semibold text-slate-900">98.4% Chromatic Print</span></div>
              <div className="flex justify-between"><span>FONT FAMILY:</span><span className="font-semibold text-slate-900">Times Roman Bold 14pt</span></div>
              <div className="flex justify-between"><span>CREST ANCHOR:</span><span className="font-semibold text-slate-900">X: 120.0mm / Y: 35.0mm</span></div>
              <div className="flex justify-between"><span>METADATA PRODUCER:</span><span className="font-semibold text-emerald-600">Institutional Engine v4.2</span></div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6 text-xs font-medium text-slate-400">
            <span>CANONICAL LEDGER #AFR-01</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-600">
              <Icon name="verified" className="text-[16px]" /> Validated Reference
            </span>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-violet-200/80 bg-white p-6 shadow-md shadow-violet-500/5 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-violet-100/40 blur-2xl"></div>
          <div>
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-600"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Document B • Submitted File</span>
              </div>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">ANOMALIES HIGHLIGHTED</span>
            </div>
            <h3 className="mb-1 text-xl font-bold text-slate-900">Submitted Transcript Copy</h3>
            <p className="mb-6 text-xs font-medium text-violet-600">Flagged 3 geometric &amp; typographic deviations</p>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3">
                <Icon name="history_edu" className="shrink-0 text-[18px] text-amber-600" />
                <div>
                  <strong className="text-slate-900">Modified Producer Metadata:</strong>
                  <span className="mt-0.5 block text-[11px] text-slate-600">XMP header indicates alteration via desktop graphics software 4h prior.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/80 p-3">
                <Icon name="format_shapes" className="shrink-0 text-[18px] text-violet-600" />
                <div>
                  <strong className="text-slate-900">Inconsistent Degree Typography:</strong>
                  <span className="mt-0.5 block text-[11px] text-slate-600">Honor classification font substituted with generic Helvetica variant.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/80 p-3">
                <Icon name="height" className="shrink-0 text-[18px] text-rose-600" />
                <div>
                  <strong className="text-slate-900">Baseline Crest Shift:</strong>
                  <span className="mt-0.5 block text-[11px] text-slate-600">Seal stamp shifted 4.2mm downward from calibrated baseline coordinates.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6 text-xs font-medium text-slate-500">
            <span>SUBMISSION #SUB-9042-X</span>
            <span className="font-semibold text-violet-700">Deviation Score: 28.4%</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const LAYERS = [
  {
    icon: "document_scanner", tag: "01 / ANALYSIS", title: "Document Analysis",
    body: "Optical token extraction, micro-typography kerning, layout geometry, and tabular column consistency.",
    foot: "Field Accuracy", value: "99.8% Recall",
  },
  {
    icon: "difference", tag: "02 / COMPARISON", title: "Reference Comparison",
    body: "Direct spatial delta calculation against authentic issuer reference templates with sub-millimeter precision.",
    foot: "Spatial Delta", value: "0.12mm Margin",
  },
  {
    icon: "hub", tag: "03 / REGISTRY", title: "Database Verification",
    body: "Direct querying against registrar SIS registers, government registries, and institutional enrollment datastores.",
    foot: "Query Latency", value: "< 380ms",
  },
  {
    icon: "fingerprint", tag: "04 / FORENSICS", title: "Integrity Signals",
    body: "Deep analysis of PDF object tree revisions, stamp opacity variances, pixel cloning, and metadata history.",
    foot: "Object Scan", value: "Deep Forensics",
  },
];

function Engine() {
  return (
    <section id="how-it-works" className="border-y border-slate-100 bg-slate-50/60 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-violet-600">Multi-Layer Architecture</span>
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Four layers. One evidence-based result.
          </h2>
          <p className="text-base text-slate-600">Eliminating single points of failure with convergent verification layers.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((l) => (
            <div key={l.title} className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-all hover:border-violet-300 hover:shadow-md">
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Icon name={l.icon} className="text-[26px]" />
                </div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-violet-600">{l.tag}</span>
                <h3 className="mb-2 text-lg font-bold text-slate-950">{l.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{l.body}</p>
              </div>
              <div className="mt-6 flex justify-between border-t border-slate-100 pt-6 text-xs font-semibold text-slate-700">
                <span>{l.foot}</span>
                <span className="text-violet-600">{l.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperatorDesk() {
  return (
    <section id="operator-desk" className="mx-auto max-w-5xl px-6 py-24">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-violet-600">Operational Philosophy</span>
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          AI assists. Authorized people decide.
        </h2>
        <p className="text-base text-slate-600 sm:text-lg">
          We don't replace the responsible officer. We empower them with unambiguous, verifiable evidence.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">KM</div>
            <div>
              <div className="text-xs font-bold text-slate-900">Dr. K. Mensah • Registrar Office Queue</div>
              <div className="text-[11px] text-slate-500">Candidate #UG-2026-904 • Clearance File</div>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            STATUS: REVIEW REQUIRED
          </span>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-center">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-violet-700">Overall Weight</span>
              <span className="text-3xl font-extrabold text-violet-700">92%</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reference Delta</span>
              <span className="text-3xl font-extrabold text-slate-900">94%</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Registry Match</span>
              <span className="text-3xl font-extrabold text-emerald-600">100%</span>
            </div>
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-center">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-amber-700">Integrity Signals</span>
              <span className="text-3xl font-extrabold text-amber-600">68%</span>
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 font-mono text-xs text-slate-700">
            <div className="mb-2 flex items-center gap-1.5 font-sans font-bold text-amber-900">
              <Icon name="warning" className="text-[18px] text-amber-700" />
              Detected Evidentiary Discrepancies
            </div>
            <p>• <strong>Metadata Mismatch:</strong> Creation library (PDF-lib v1.4.1) does not match university registrar imprint format.</p>
            <p>• <strong>Spatial Deviation:</strong> Degree header baseline shifted 4.2mm relative to 2024 Template Matrix.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon name="verified_user" className="text-[16px] text-violet-600" />
              Every determination generates an immutable cryptographic signature.
            </div>
            <div className="flex items-center gap-3">
              <Link className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50" to="/settings">
                Review Configuration
              </Link>
              <Link className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-700" to="/dashboard">
                Approve in Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const rows = [
    {
      icon: "domain", title: "Tenant Isolation & Key Management",
      body: "Dedicated logical databases and isolated encryption keys prevent cross-organization document leakage.",
    },
    {
      icon: "lock", title: "Encrypted at Rest & In-Transit",
      body: "AES-256 field-level data protection, TLS 1.3 encryption, and ephemeral memory-isolated processing.",
    },
    {
      icon: "history_toggle_off", title: "Immutable Audit Logs",
      body: "Cryptographic log proof for every automated check and human decision, tamper-evident and exportable.",
    },
  ];
  return (
    <section id="security" className="border-y border-slate-100 bg-slate-50/60 py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-6">
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-violet-600">Institutional Rigor</span>
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Built for sensitive records.
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              Enterprise data protection architected strictly for banks, ministries, and academic institutions.
            </p>
          </div>
          <div className="space-y-6">
            {rows.map((r) => (
              <div key={r.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-violet-600 shadow-sm">
                  <Icon name={r.icon} className="text-[20px]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{r.title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#030712] p-6 text-slate-200 shadow-2xl sm:p-7 lg:col-span-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">POST</span>
              <span className="font-mono text-xs text-slate-300">/api/v1/verifications</span>
            </div>
            <span className="font-mono text-[11px] text-violet-400">cURL REST • 742ms</span>
          </div>
          <pre className="overflow-x-auto p-2 font-mono text-xs leading-relaxed text-slate-300">
{`{
  "verification_id": "vrx_8910a27f8c",
  "status": "review_required",
  "confidence": 0.92,
  "reference_match": 0.94,
  "database_match": true,
  "evidence": [
    {
      "type": "metadata_anomaly",
      "severity": "medium",
      "flag": "Desktop editor modification detected"
    }
  ]
}`}
          </pre>
          <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
            <span>Client SDKs: Python • Node.js • Go</span>
            <Link className="flex items-center gap-1 font-medium text-violet-400 hover:text-violet-300" to="/login">
              Open the App <Icon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-violet-100/50 via-white to-white"></div>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          <span className="h-2 w-2 rounded-full bg-violet-600"></span>
          EVIDENCE-BASED PLATFORM
        </div>
        <h2 className="mb-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          Turn document verification <br className="hidden sm:inline" />
          into a system.
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-slate-600">
          Give your organization a trusted reference library, an evidence-based verification engine, and a workflow built for human review.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link className="rounded-full bg-violet-600 px-8 py-4 text-[15px] font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-700" to="/register">
            Create Your Workspace
          </Link>
          <Link className="rounded-full border border-slate-200 bg-white px-8 py-4 text-[15px] font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50" to="/login">
            Sign In
          </Link>
        </div>
        <div className="mt-12 text-xs font-medium text-slate-400">
          Deploy on Cloud or VPC • SOC-2 &amp; NDPR / GDPR Compliant • Rapid Pilot Integration
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-3">
          <Brand size="h-6" />
          <span className="text-xs text-slate-400">© {new Date().getFullYear()} Verifo. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-8 text-xs font-medium text-slate-500">
          <Link className="transition-colors hover:text-slate-900" to="/login">Sign in</Link>
          <Link className="transition-colors hover:text-slate-900" to="/register">Create account</Link>
          <a className="transition-colors hover:text-slate-900" href="#security">Security Overview</a>
          <a className="transition-colors hover:text-slate-900" href="#product">System Status</a>
        </div>
      </div>
    </footer>
  );
}