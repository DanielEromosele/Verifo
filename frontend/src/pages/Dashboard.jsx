import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api("/health").then(setHealth).catch(() => {});
    api("/users")
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  const isAdmin = user?.role === "ADMIN";
  const isOperator = user?.role === "OPERATOR";

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          {user?.organization?.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {isAdmin
            ? "You manage this organization, its references, and verification configuration."
            : isOperator
            ? "Single verification and bulk screening await below."
            : "Track your submitted documents and verification status."}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Foundation" value={health?.status === "ok" ? "Online" : "Offline"} tone={health?.status === "ok" ? "ok" : "bad"} />
        <StatCard label="Database" value={health?.database || "…"} tone={health?.database === "ok" ? "ok" : "neutral"} />
        <StatCard label="Organization slug" value={user?.organization?.slug || "…"} />
        <StatCard label="Your role" value={user?.role || "…"} />
      </section>

      <section className="card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-ink-900">Organization members</h2>
          {isAdmin && <span className="text-xs text-ink-500">Admin view — manage in Phase 6</span>}
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-ink-100">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                    Loading members…
                  </td>
                </tr>
              )}
              {users.map((m) => (
                <tr key={m.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-medium text-ink-800">{m.user?.full_name}</td>
                  <td className="px-4 py-3 text-ink-600">{m.user?.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    ok: "text-brand-600",
    bad: "text-red-600",
    neutral: "text-ink-900",
  };
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}