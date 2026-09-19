import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to your workspace"
      subtitle="Enter your email and password to start verifying documents."
      footer={
        <>
          New organization?{" "}
          <Link to="/register" className="font-semibold text-[#0056d2] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full !bg-[#0056d2] hover:!bg-[#0045ab]">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Demo workspace</p>
        <p className="mt-1 text-sm text-ink-600">
          Pre-seeded demo: <span className="font-mono text-xs">admin@demo.edu</span> /{" "}
          <span className="font-mono text-xs">verifo-demo-admin</span>
        </p>
      </div>
    </AuthLayout>
  );
}