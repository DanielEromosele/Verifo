import { useEffect, useState } from "react";
import { api, upload } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, EmptyState, PageHeader, Spinner, statusTone } from "../components/ui";

const REF_STATUSES = ["ACTIVE", "ARCHIVED"];

export default function References() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [references, setReferences] = useState([]);
  const [types, setTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api("/references").then((d) => setReferences(d.references || [])).catch(() => {});
  };

  useEffect(() => {
    Promise.all([api("/references"), api("/document-types")]).then(([r, t]) => {
      setReferences(r.references || []);
      setTypes(t.document_types || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = references.filter((r) =>
    `${r.title ?? ""} ${r.ref_code ?? ""} ${r.filename ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  const open = async (r) => {
    const d = await api(`/references/${r.id}`).catch(() => null);
    setSelected(d ? d.reference : r);
  };

  const setStatus = async (status) => {
    const d = await api(`/references/${selected.id}`, { method: "PATCH", body: { status } }).catch(() => null);
    if (d) {
      setSelected(d.reference);
      refresh();
    }
  };

  if (loading) return <Spinner label="Loading reference library…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trusted reference library"
        title="References"
        subtitle="Publish the authoritative copies your institution issues."
        actions={isAdmin ? <CreateRef types={types} onDone={refresh} /> : null}
      />

      <input
        className="input max-w-sm"
        placeholder="Search references…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">Library</h2>
            <p className="text-xs text-ink-500">{filtered.length} reference(s)</p>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No references yet" body="Publish a trusted copy to begin — it becomes the base of comparison for every screening." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => open(r)}
                    className={`w-full px-5 py-3.5 text-left transition hover:bg-ink-50 ${
                      selected?.id === r.id ? "bg-[#0056d2]/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink-800">{r.title}</p>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {r.ref_code} · {r.document_type?.code || "REF"} · {r.extracted_fields?.length ?? 0} field(s)
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="xl:col-span-3">
          {selected ? (
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{selected.title}</h2>
                  <p className="mt-1 text-xs text-ink-500">
                    {selected.ref_code} · {selected.document_type?.name || "Generic"} · uploaded{" "}
                    {selected.created_at ? new Date(selected.created_at).toLocaleString() : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                    <Badge tone="ink">checksum {selected.fingerprint?.sha256?.slice(0, 12) || "…"}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.download_token && (
                    <a href={`/api/v1/downloads/${selected.download_token}`} className="btn-secondary text-xs">
                      Download copy
                    </a>
                  )}
                  {isAdmin && selected.status === "ACTIVE" && (
                    <button onClick={() => setStatus("ARCHIVED")} className="btn-secondary text-xs">
                      Archive
                    </button>
                  )}
                  {isAdmin && selected.status === "ARCHIVED" && (
                    <button onClick={() => setStatus("ACTIVE")} className="btn-secondary text-xs">
                      Reactivate
                    </button>
                  )}
                </div>
              </div>

              {selected.baseline?.producer ? (
                <div className="mt-5 rounded-lg border border-ink-100 bg-ink-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Producer baseline</p>
                  <p className="mt-1 max-h-40 overflow-auto font-mono text-xs text-ink-700">
                    {JSON.stringify(selected.baseline, null, 2)}
                  </p>
                </div>
              ) : null}

              <h3 className="mt-6 text-sm font-bold text-ink-900">Extracted fields</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-ink-100 text-sm">
                  <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
                    <tr>
                      <th className="px-4 py-2.5">Field</th>
                      <th className="px-4 py-2.5">Confidence</th>
                      <th className="px-4 py-2.5">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {(selected.fields || []).map((f, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-medium text-ink-800">{f.key || f.field}</td>
                        <td className="px-4 py-2.5">
                          {f.confidence != null ? `${Math.round(f.confidence * 100)}%` : "—"}
                        </td>
                        <td className="max-w-[300px] truncate px-4 py-2.5 font-mono text-xs text-ink-600">
                          {String(f.value ?? f.raw ?? "").slice(0, 120)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(selected.fields || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-500">No fields extracted from this reference.</p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8">
              <EmptyState
                title="Select a reference"
                body="Open a reference to inspect its fingerprint, embedded fields, and producer baseline."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  function CreateRef({ types, onDone }) {
    const [title, setTitle] = useState("");
    const [typeId, setTypeId] = useState("");
    const [file, setFile] = useState(null);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const submit = async () => {
      setErr(""); setMsg("");
      if (!title.trim()) return setErr("A title is required.");
      if (!file) return setErr("Choose a reference file.");
      try {
        await upload("/references", {
          file,
          extra: { title: title.trim(), document_type_id: typeId || undefined },
        });
        setMsg("Reference processed and added to the library.");
        setTitle(""); setFile(null); setTypeId("");
        onDone();
      } catch (e) {
        setErr(e.message || "Upload failed.");
      }
    };

    return (
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-ink-900">Publish reference</h3>
        <div className="mt-3 space-y-3">
          <input className="input" placeholder="Reference title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Generic document</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0])} className="input" />
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>}
          <button onClick={submit} className="btn-primary w-full !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">
            Process & publish
          </button>
        </div>
      </div>
    );
  }
}