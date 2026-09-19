import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, EmptyState, PageHeader, Spinner, statusTone, Badge } from "../components/ui";

const TABS = ["Configuration", "Team", "API keys", "Audit log"];

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState(isAdmin ? "Configuration" : "Audit log");
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      api("/admin/settings").then((d) => setSettings(d.settings)).catch(() => {});
      api("/api-keys").then((d) => setKeys(d.api_keys || [])).catch(() => {});
      api("/users").then((d) => setUsers(d.users || [])).catch(() => {});
      api("/admin/audit").then((d) => setAudit(d.entries || [])).catch(() => {});
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Settings" title="Settings" subtitle="Only administrators can change organization configuration." />
        <Card className="p-8">
          <EmptyState title="No access" body="Reach out to an organization administrator to adjust configuration." />
        </Card>
      </div>
    );
  }

  if (!settings) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Workspace settings" subtitle="Tune verification, manage your team and API access." />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t ? "bg-[#0056d2] text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Configuration" && <ConfigTab settings={settings} onSave={setSettings} />}
      {tab === "Team" && <TeamTab users={users} refresh={() => api("/users").then((d) => setUsers(d.users || []))} />}
      {tab === "API keys" && <KeysTab keys={keys} refresh={() => api("/api-keys").then((d) => setKeys(d.api_keys || []))} />}
      {tab === "Audit log" && <AuditTab entries={audit} />}
    </div>
  );
}

function ConfigTab({ settings, onSave }) {
  const w = settings.weights || {};
  const t0 = settings.thresholds || {};
  const [weights, setWeights] = useState({
    ocr: w.ocr ?? 0.35,
    database: w.database ?? 0.25,
    reference: w.reference ?? 0.25,
    integrity: w.integrity ?? 0.15,
  });
  const [thresholds, setThresholds] = useState({
    verified_min: t0.verified_min ?? 80,
    review_min: t0.review_min ?? 50,
  });
  const [requiredFields, setRequiredFields] = useState(settings.required_fields || []);
  const [fieldInput, setFieldInput] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
    setErr(""); setMsg("");
    const ws = { ...weights };
    ws.integrity = Math.max(0, Math.min(1, 1 - ws.ocr - ws.database - ws.reference));
    setWeights(ws);
    const sum = ws.ocr + ws.database + ws.reference + ws.integrity;
    if (Math.abs(sum - 1) > 0.01) return setErr("Weights must sum to exactly 1.");
    if (thresholds.review_min > thresholds.verified_min) return setErr("Review threshold can't exceed the verified threshold.");
    try {
      const d = await api("/admin/settings", {
        method: "PUT",
        body: { weights: ws, thresholds, required_fields: requiredFields },
      });
      onSave(d.settings);
      setMsg("Configuration saved and audited.");
    } catch (e) {
      setErr(e.message || "Save failed.");
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-base font-bold text-ink-900">Verification scoring</h2>
      <p className="mt-1 text-xs text-ink-500">
        Sub-signals are scored 0–100 and blended by these weights into a 0–100 confidence score.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(weights).map(([k, v]) => (
          <div key={k}>
            <label className="label">{k} weight</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="input"
              value={Math.round(v * 100)}
              onChange={(e) => setWeights((s) => ({ ...s, [k]: Math.round((Number(e.target.value) || 0)) / 100 }))}
            />
            <p className="mt-1 text-[11px] text-ink-500">{Math.round(v * 100)}% of total</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Verified threshold (0–100)</label>
          <input type="number" min="0" max="100" className="input" value={thresholds.verified_min} onChange={(e) => setThresholds((s) => ({ ...s, verified_min: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Review threshold (0–100)</label>
          <input type="number" min="0" max="100" className="input" value={thresholds.review_min} onChange={(e) => setThresholds((s) => ({ ...s, review_min: Number(e.target.value) }))} />
        </div>
      </div>

      <div className="mt-6">
        <label className="label">Required fields (document metadata)</label>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="e.g. student_full_name" value={fieldInput} onChange={(e) => setFieldInput(e.target.value)} />
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              const v = fieldInput.trim();
              if (v && !requiredFields.includes(v)) setRequiredFields((r) => [...r, v]);
              setFieldInput("");
            }}
          >
            Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {requiredFields.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">
              {f}
              <button onClick={() => setRequiredFields((r) => r.filter((x) => x !== f))} className="text-ink-400 hover:text-red-600">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      <button onClick={save} className="btn-primary mt-5 !bg-[#0056d2] hover:!bg-[#0045ab]">
        Save configuration
      </button>
    </Card>
  );
}

function TeamTab({ users, refresh }) {
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "OPERATOR", password: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const invite = async () => {
    setErr(""); setMsg("");
    try {
      await api("/users/invite", { method: "POST", body: form });
      setMsg(`${form.email} added as ${form.role}.`);
      setShowInvite(false);
      setForm({ email: "", full_name: "", role: "OPERATOR", password: "" });
      refresh();
    } catch (e) {
      setErr(e.message || "Invite failed.");
    }
  };

  const setStatus = async (u, status) => {
    await api(`/admin/users/${u.user.id}/status`, { method: "POST", body: { status } }).catch(() => {});
    refresh();
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <h2 className="text-base font-bold text-ink-900">Team members</h2>
        <button onClick={() => setShowInvite((s) => !s)} className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">
          {showInvite ? "Cancel" : "Add member"}
        </button>
      </div>

      {showInvite && (
        <div className="grid gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <input className="input" placeholder="Full name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input" placeholder="Temporary password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="OPERATOR">OPERATOR</option>
            <option value="SUBMITTER">SUBMITTER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <div className="flex items-center gap-2">
            <button onClick={invite} className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">Invite</button>
          </div>
        </div>
      )}
      {err && <p className="border-b border-ink-100 px-5 py-2 text-xs text-red-700">{err}</p>}
      {msg && <p className="border-b border-ink-100 px-5 py-2 text-xs text-emerald-700">{msg}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100 text-sm">
          <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {users.map((m) => (
              <tr key={m.id} className="hover:bg-ink-50/50">
                <td className="px-5 py-3 font-medium text-ink-800">{m.user?.full_name}</td>
                <td className="px-5 py-3 text-ink-600">{m.user?.email}</td>
                <td className="px-5 py-3"><Badge tone={statusTone(m.role)}>{(m.role || "").toUpperCase()}</Badge></td>
                <td className="px-5 py-3">{m.status}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {m.status === "ACTIVE" ? (
                      <button onClick={() => setStatus(m, "SUSPENDED")} className="text-xs font-semibold text-amber-700 hover:underline">
                        Suspend
                      </button>
                    ) : (
                      <button onClick={() => setStatus(m, "ACTIVE")} className="text-xs font-semibold text-emerald-700 hover:underline">
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function KeysTab({ keys, refresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState("");
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");

  const create = async () => {
    setErr(""); setSecret("");
    if (!name.trim()) return setErr("A name is required.");
    try {
      const d = await api("/api-keys", {
        method: "POST",
        body: { name: name.trim(), ttl_days: ttl ? Number(ttl) : undefined },
      });
      setSecret(d.secret);
      setName(""); setTtl(""); setShowCreate(false);
      refresh();
    } catch (e) {
      setErr(e.message || "Could not create key.");
    }
  };

  const revoke = async (k) => {
    await api(`/api-keys/${k.id}`, { method: "DELETE" }).catch(() => {});
    refresh();
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <h2 className="text-base font-bold text-ink-900">API keys</h2>
        <button onClick={() => setShowCreate((s) => !s)} className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">
          {showCreate ? "Cancel" : "New key"}
        </button>
      </div>

      {secret && (
        <div className="border-b border-ink-100 bg-amber-50 px-5 py-4">
          <p className="text-xs font-semibold text-amber-800">Copy this secret now — it will never be shown again.</p>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-ink-800 ring-1 ring-amber-200">
            {secret}
          </code>
        </div>
      )}

      {showCreate && (
        <div className="grid gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-4 sm:grid-cols-3">
          <input className="input" placeholder="Key name (e.g. integrity-checker)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="TTL days (optional)" type="number" min="1" max="3650" value={ttl} onChange={(e) => setTtl(e.target.value)} />
          <button onClick={create} className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">Generate</button>
        </div>
      )}
      {err && <p className="border-b border-ink-100 px-5 py-2 text-xs text-red-700">{err}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100 text-sm">
          <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Prefix</th>
              <th className="px-5 py-3">Expires</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-ink-50/50">
                <td className="px-5 py-3 font-medium text-ink-800">{k.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-ink-600">{k.prefix}…</td>
                <td className="px-5 py-3 text-ink-600">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "never"}</td>
                <td className="px-5 py-3 text-ink-600">{k.created_at ? new Date(k.created_at).toLocaleDateString() : ""}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => revoke(k)} className="text-xs font-semibold text-red-700 hover:underline">
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {keys.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No API keys yet. Generate one for system integrations.</p>
        )}
      </div>
    </Card>
  );
}

function AuditTab({ entries }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 px-5 py-4">
        <h2 className="text-base font-bold text-ink-900">Audit trail</h2>
        <p className="text-xs text-ink-500">Append-only record of every meaningful action in this organization.</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No audit entries yet" body="Actions such as config changes, decisions, and uploads will appear here." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-800">{e.action}</p>
                <p className="text-xs text-ink-500">{e.summary}</p>
              </div>
              <div className="text-right">
                <Badge tone="ink">{e.actor_email || e.actor_id || "system"}</Badge>
                <p className="mt-1 text-[11px] text-ink-500">{e.created_at ? new Date(e.created_at).toLocaleString() : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}