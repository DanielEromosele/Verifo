import { useEffect, useRef, useState } from "react";
import { api, upload } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, EmptyState, PageHeader, Progress, ScoreRing, Spinner, statusTone } from "../components/ui";

export default function Verify() {
  const { user } = useAuth();
  const [references, setReferences] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/references").then((d) => setReferences(d.references || [])).catch(() => {});
    refresh();
  }, []);

  const refresh = () => {
    api("/verifications").then((d) => setVerifications(d.verifications || [])).catch(() => {});
  };

  const pick = async (v) => {
    try {
      const d = await api(`/verifications/${v.id}`);
      setSelected(d.verification);
    } catch {
      setSelected(v);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Single verification"
        title="Verify a document"
        subtitle="Upload a submission and compare it against your trusted reference library."
      />

      <SubmitCard references={references} onDone={refresh} busy={busy} setBusy={setBusy} />

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">Results</h2>
            <p className="text-xs text-ink-500">{verifications.length} submission(s)</p>
          </div>
          {verifications.length === 0 ? (
            <EmptyState title="No verifications yet" body="Upload a document to see scored results here." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {verifications.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => pick(v)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-ink-50 ${
                      selected?.id === v.id ? "bg-[#0056d2]/5" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-ink-800">{v.filename}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {v.created_at ? new Date(v.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-800">{v.score != null ? Math.round(v.score) : "—"}</span>
                      <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="xl:col-span-3">
          {selected ? <Detail verification={selected} onRefresh={() => { refresh(); pick(selected); }} /> : (
            <Card className="p-8">
              <EmptyState
                title="Select a result to inspect"
                body="Choose a submission on the left to see its score breakdown, field conclusions, evidence, and the operator decision panel."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  function SubmitCard({ references: refs, onDone }) {
    const [file, setFile] = useState(null);
    const [referenceId, setReferenceId] = useState("");
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    const submit = async () => {
      if (!file) {
        setError("Choose a file first.");
        return;
      }
      setBusy(true);
      setMsg("");
      setError("");
      try {
        await upload("/verifications", {
          file,
          extra: referenceId ? { reference_id: referenceId } : {},
        });
        setMsg("Submitted — the worker is processing it now.");
        fileRef.current.value = "";
        setFile(null);
        onDone();
      } catch (err) {
        setError(err.message || "Upload failed.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <Card className="p-6">
        <h2 className="text-base font-bold text-ink-900">New submission</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <label className="label">Reference to compare against (optional)</label>
            <select className="input" value={referenceId} onChange={(e) => setReferenceId(e.target.value)}>
              <option value="">No reference (library lookup only)</option>
              {refs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.ref_code})
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="label">Document file</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0])} className="input" />
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        <button onClick={submit} disabled={busy} className="btn-primary mt-4 !bg-[#0056d2] hover:!bg-[#0045ab]">
          {busy ? "Uploading…" : "Submit for verification"}
        </button>
      </Card>
    );
  }
}

function Detail({ verification, onRefresh }) {
  const [decision, setDecision] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const v = verification;
  const reviewable = v.status === "REVIEW" || v.status === "VERIFIED";

  const submitDecision = async () => {
    setBusy(true);
    setErr(""); setMsg("");
    try {
      await api(`/verifications/${v.id}/decision`, { method: "POST", body: { decision, comment } });
      setMsg("Decision recorded and audited.");
      setDecision("");
      setComment("");
      onRefresh();
    } catch (e) {
      setErr(e.message || "Could not record decision.");
    } finally {
      setBusy(false);
    }
  };

  const sensitive = decision === "REJECTED" || (v.score ?? 0) < 80;
  const bd = v.breakdown || {};
  const parts = [
    ["OCR / extraction", bd.ocr],
    ["Reference comparison", bd.reference],
    ["Library lookup", bd.database],
    ["Integrity heuristics", bd.integrity],
  ];

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink-900">{v.filename}</h2>
            <p className="mt-1 text-xs text-ink-500">
              {v.reference ? `Compared against ${v.reference.title} (${v.reference.ref_code})` : "No explicit reference selected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(v.status)}>{v.status}</Badge>
            {v.decision && <Badge tone={statusTone(v.decision)}>{v.decision}</Badge>}
          </div>
        </div>
        {v.download_token && (
          <a href={`/api/v1/downloads/${v.download_token}`} className="mt-2 inline-block text-sm font-semibold text-[#0056d2] hover:underline">
            Download submitted file
          </a>
        )}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <ScoreRing value={v.score} />
          <div className="min-w-[240px] flex-1 space-y-2.5">
            {parts.map(([label, val]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-600">{label}</span>
                  <span className="font-bold text-ink-800">{val != null ? Math.round(val) : "—"}</span>
                </div>
                <Progress value={val || 0} className="mt-1 h-1.5" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {(v.conclusion?.length > 0 || (v.issues?.length > 0 && user?.role !== "SUBMITTER")) && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-ink-900">Field & finding signals</h3>
          <ul className="mt-4 space-y-2.5">
            {(v.conclusion || []).map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-ink-800">{c.finding || c.key}</p>
                  {c.reference ? (
                    <p className="text-xs text-ink-500">
                      reference: <span className="font-mono">{c.reference}</span> · submitted:{" "}
                      <span className="font-mono">{c.submitted}</span>
                    </p>
                  ) : null}
                </div>
                <Badge tone={statusTone(c.status.toUpperCase())}>{c.status.toUpperCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(v.evidence?.length > 0) && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-ink-900">Evidence</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
            {v.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0056d2]" />
                {e}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reviewable && user?.role !== "SUBMITTER" && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-ink-900">Operator decision</h3>
          <p className="mt-1 text-xs text-ink-500">
            A comment is {sensitive ? "required" : "encouraged"} for {(sensitive ? "rejections / low scores" : "all decisions")}.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <select className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="">Choose decision…</option>
              <option value="VERIFIED">VERIFIED — accept</option>
              <option value="REJECTED">REJECTED — reject</option>
            </select>
            <input
              className="input lg:col-span-2"
              placeholder="Add a comment for the audit trail…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
          <div className="mt-4 flex gap-3">
            <button onClick={submitDecision} disabled={busy || !decision} className="btn-primary !bg-[#0056d2] hover:!bg-[#0045ab]">
              {busy ? "Recording…" : "Record decision"}
            </button>
            {v.decision && <span className="self-center text-xs text-ink-500">Last decision: {v.decision}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}