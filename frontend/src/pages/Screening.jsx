import { useEffect, useState } from "react";
import { api, upload } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, EmptyState, PageHeader, Progress, Spinner, statusTone } from "../components/ui";

export default function Screening() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [jobs, setJobs] = useState([]);
  const [references, setReferences] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    api("/screening/jobs").then((d) => setJobs(d.jobs || [])).catch(() => {});
  };

  useEffect(() => {
    refresh();
    api("/references").then((d) => setReferences(d.references || [])).catch(() => {});
  }, []);

  const openJob = async (job) => {
    setSelectedJob(job);
    const d = await api(`/screening/jobs/${job.id}/items`).catch(() => null);
    if (d) setSelectedJob({ ...job, items: d.items || [] });
  };

  const retry = async (job) => {
    setBusy(true);
    try {
      await api(`/screening/jobs/${job.id}/retry`, { method: "POST" });
      await openJob(job);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk screening"
        title="Screening jobs"
        subtitle="Process batches of documents against a single trusted reference."
        actions={isAdmin ? <CreateJob refs={references} onDone={() => { refresh(); setTimeout(openJob, 300); }} busySelf={busy} /> : null}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">Jobs</h2>
            <p className="text-xs text-ink-500">{jobs.length} job(s)</p>
          </div>
          {jobs.length === 0 ? (
            <EmptyState title="No screening jobs yet" body="Create a job to screen a batch of documents." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {jobs.map((job) => {
                const pct = job.total_count
                  ? Math.round(((job.done_count || 0) / job.total_count) * 100)
                  : 0;
                return (
                  <li key={job.id}>
                    <button
                      onClick={() => openJob(job)}
                      className={`w-full px-5 py-4 text-left transition hover:bg-ink-50 ${
                        selectedJob?.id === job.id ? "bg-[#0056d2]/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-800">
                            {job.title || `Job #${job.id.slice(0, 8)}`}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-500">
                            {job.processed_count || 0}/{job.total_count} processed ·{" "}
                            {job.created_at ? new Date(job.created_at).toLocaleString() : ""}
                          </p>
                        </div>
                        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                      </div>
                      <Progress value={pct} className="mt-3 h-1.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">
              Items {selectedJob ? `— ${selectedJob.title || selectedJob.id.slice(0, 8)}` : ""}
            </h2>
            {selectedJob && isAdmin && (
              <button onClick={() => retry(selectedJob)} disabled={busy} className="btn-secondary text-xs">
                Retry failed
              </button>
            )}
          </div>
          {!selectedJob ? (
            <EmptyState title="Select a job" body="Choose a job on the left to inspect its items and outcomes." />
          ) : !selectedJob.items ? (
            <Spinner label="Loading items…" />
          ) : selectedJob.items.length === 0 ? (
            <EmptyState title="No items yet" body="Items appear here once documents are extracted from the upload." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {selectedJob.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800">{it.filename}</p>
                    <p className="text-[11px] text-ink-500">
                      score: {it.score != null ? Math.round(it.score) : "—"}
                      {it.error ? ` · ${it.error}` : ""}
                    </p>
                  </div>
                  <Badge tone={statusTone(it.status)}>{it.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );

  function CreateJob({ refs, onDone }) {
    const [title, setTitle] = useState("");
    const [referenceId, setReferenceId] = useState("");
    const [file, setFile] = useState(null);
    const [files, setFiles] = useState([]);
    const [mode, setMode] = useState("zip");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const submit = async () => {
      setErr(""); setMsg("");
      if (mode === "zip" && !file) return setErr("Choose a ZIP archive.");
      if (mode === "multi" && files.length === 0) return setErr("Add at least one file.");
      try {
        await upload("/screening/jobs", {
          file: mode === "zip" ? file : null,
          files: mode === "multi" ? files : [],
          extra: { title: title.trim(), reference_id: referenceId || undefined },
        });
        setMsg("Job created and queued for processing.");
        setTitle(""); setFiles([]); setFile(null);
        onDone();
      } catch (e) {
        setErr(e.message || "Could not create job.");
      }
    };

    return (
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-ink-900">New screening job</h3>
        <div className="mt-3 space-y-3">
          <input className="input" placeholder="Job title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input" value={referenceId} onChange={(e) => setReferenceId(e.target.value)}>
            <option value="">No reference (library lookup only)</option>
            {refs.map((r) => (
              <option key={r.id} value={r.id}>{r.title} ({r.ref_code})</option>
            ))}
          </select>
          <div className="flex gap-2">
            {["zip", "multi"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  mode === m ? "bg-[#0056d2] text-white" : "bg-ink-100 text-ink-600"
                }`}
              >
                {m === "zip" ? "ZIP archive" : "Multiple files"}
              </button>
            ))}
          </div>
          {mode === "zip" ? (
            <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files[0])} className="input" />
          ) : (
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={(e) => setFiles([...e.target.files])} className="input" />
          )}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>}
          <button onClick={submit} className="btn-primary w-full !bg-[#0056d2] hover:!bg-[#0045ab] text-sm">
            Create & queue
          </button>
        </div>
      </div>
    );
  }
}