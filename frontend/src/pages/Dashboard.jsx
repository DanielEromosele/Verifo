import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, PageHeader, Spinner, statusTone } from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN";
  const isStaff = isAdmin || user?.role === "OPERATOR";

  useEffect(() => {
    if (!isStaff) {
      setLoading(false);
      return;
    }
    Promise.allSettled([
      api("/admin/analytics"),
      api("/verifications"),
      api("/users"),
    ]).then(([a, v, u]) => {
      if (a.status === "fulfilled") setAnalytics(a.value.analytics);
      if (v.status === "fulfilled") setVerifications(v.value.verifications || []);
      if (u.status === "fulfilled") setUsers(u.value.users || []);
      setLoading(false);
    });
  }, [isStaff]);

  if (loading) return <Spinner label="Loading dashboard…" />;

  const a = analytics;
  const maxDay = Math.max(1, ...Object.values(a?.per_day || {}).map(Number));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={user?.organization?.name || "Workspace"}
        title={`Welcome back, ${user?.full_name?.split(" ")[0] || "there"}`}
        subtitle={
          isAdmin
            ? "You administer this organization, its references, and verification configuration."
            : isStaff
            ? "Single verification and bulk screening await below."
            : "Your workspace is ready."
        }
        actions={
          user?.role === "SUBMITTER" ? null : (
            <>
              <Link to="/verify" className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab]">
                Verify a document
              </Link>
              <Link to="/screening" className="btn-secondary">
                Bulk screening
              </Link>
            </>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Processed (30 days)" value={a?.volume ?? "—"} tone="ink" />
        <Stat label="Avg confidence score" value={a?.avg_score != null ? `${a.avg_score}/100` : "—"} tone="ink" />
        <Stat label="Flagged for review" value={a?.flagged_ratio != null ? `${(a.flagged_ratio * 100).toFixed(0)}%` : "—"} tone="warn" />
        <Stat label="Screening jobs" value={a?.jobs ?? "—"} tone="ink" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="text-base font-bold text-ink-900">Verification volume</h2>
          <p className="text-xs text-ink-500">Document outcomes over the last {a?.days || 30} days</p>
          {a?.per_day && Object.keys(a.per_day).length > 0 ? (
            <div className="mt-5 flex h-44 items-end gap-1">
              {Object.entries(a.per_day).map(([day, n]) => (
                <div key={day} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-[#0056d2] transition group-hover:bg-[#0045ab]"
                    style={{ height: `${Math.max(4, (n / maxDay) * 160)}px` }}
                    title={`${day}: ${n}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-ink-500">No verifications yet — submit your first document.</p>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-ink-900">Outcome distribution</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(a?.by_status || {}).map(([status, n]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <Badge tone={statusTone(status)}>{status}</Badge>
                <span className="font-semibold text-ink-800">{n}</span>
              </div>
            ))}
            {(!a?.by_status || Object.keys(a.by_status).length === 0) && (
              <p className="text-sm text-ink-500">Nothing yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-bold text-ink-900">Recent verifications</h2>
          <Link to="/verify" className="text-sm font-semibold text-[#0056d2] hover:underline">
            Open verification view
          </Link>
        </div>
        {verifications.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-500">
            No submissions yet. Upload your first document to see results here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {verifications.slice(0, 8).map((v) => (
                  <tr key={v.id} className="hover:bg-ink-50/50">
                    <td className="max-w-[220px] truncate px-5 py-3 font-medium text-ink-800">{v.filename}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone(v.status)}>{v.status}</Badge></td>
                    <td className="px-5 py-3 font-semibold text-ink-800">{v.score != null ? Math.round(v.score) : "—"}</td>
                    <td className="px-5 py-3 text-ink-600">{v.decision || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">Team members</h2>
            <Link to="/settings" className="text-sm font-semibold text-[#0056d2] hover:underline">
              Manage in settings
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {users.map((m) => (
                  <tr key={m.id} className="hover:bg-ink-50/50">
                    <td className="px-5 py-3 font-medium text-ink-800">{m.user?.full_name}</td>
                    <td className="px-5 py-3 text-ink-600">{m.user?.email}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone(m.role)}>{(m.role || "").toUpperCase()}</Badge></td>
                    <td className="px-5 py-3">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ink" }) {
  const tones = { ink: "text-ink-900", warn: "text-amber-600", ok: "text-emerald-600" };
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tones[tone]}`}>{value}</p>
    </Card>
  );
}