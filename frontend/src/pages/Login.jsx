import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 3h9l4 4v14H6V3Z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M15 3v4h4" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-bold tracking-tight">Verifo</p>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Issuer-first document verification.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            Institutions establish trusted references. Verifo analyzes submitted
            documents against them — producing verification confidence, detected
            inconsistencies, and an operator decision workflow.
          </p>
        </div>
        <p className="text-xs text-ink-400">Verification confidence — never absolute guarantees.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-ink-900">Sign in</h2>
          <p className="mt-1 text-sm text-ink-600">Access your verification workspace.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-600">
            New institution?{" "}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}