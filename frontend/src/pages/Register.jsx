import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    org_name: "",
    org_slug: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSlug = (e) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setForm((f) => ({ ...f, org_slug: raw }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        org_name: form.org_name.trim(),
        org_slug: form.org_slug.trim() || undefined,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your organization"
      subtitle="You will be the admin of a new verification workspace."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-[#0056d2] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="full_name">Your name</label>
            <input id="full_name" required className="input" placeholder="Ada Doe" value={form.full_name} onChange={set("full_name")} />
          </div>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" type="email" required className="input" placeholder="you@university.edu" value={form.email} onChange={set("email")} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="org_name">Organization name</label>
          <input id="org_name" required className="input" placeholder="University of Excellence" value={form.org_name} onChange={set("org_name")} />
        </div>
        <div>
          <label className="label" htmlFor="org_slug">Organization slug (optional, URL-safe)</label>
          <input id="org_slug" className="input font-mono" placeholder="university-of-excellence" value={form.org_slug} onChange={setSlug} />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} className="input" placeholder="At least 8 characters" value={form.password} onChange={set("password")} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full !bg-[#0056d2] hover:!bg-[#0045ab]">
          {busy ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>
    </AuthLayout>
  );
}