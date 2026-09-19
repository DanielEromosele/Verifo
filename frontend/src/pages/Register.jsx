import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    org_name: "",
    org_slug: "",
    industry: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-brand-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-bold tracking-tight text-ink-900">Verifo</p>
        </div>

        <div className="mt-8 rounded-xl border border-ink-100 bg-white p-7 shadow-card">
          <h2 className="text-xl font-bold text-ink-900">Create your organization</h2>
          <p className="mt-1 text-sm text-ink-600">
            Your organization becomes a trusted, tenant-isolated verification workspace.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="org_name">Organization name</label>
              <input id="org_name" className="input" required placeholder="University of Benin" value={form.org_name} onChange={set("org_name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="org_slug">Slug (optional)</label>
                <input id="org_slug" className="input" placeholder="uniben" value={form.org_slug} onChange={set("org_slug")} />
              </div>
              <div>
                <label className="label" htmlFor="industry">Industry</label>
                <input id="industry" className="input" placeholder="University" value={form.industry} onChange={set("industry")} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="full_name">Your full name</label>
              <input id="full_name" className="input" required placeholder="Ada Johnson" value={form.full_name} onChange={set("full_name")} />
            </div>
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input id="email" type="email" className="input" required placeholder="you@institution.edu" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" required minLength={8} placeholder="At least 8 characters" value={form.password} onChange={set("password")} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Creating workspace…" : "Create workspace"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-ink-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}