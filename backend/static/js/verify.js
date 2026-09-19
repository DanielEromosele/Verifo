/* Verify page: submit a document, browse results, inspect detail + decide. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Verifo.esc(s); }
  function fmt(d) { return d ? new Date(d).toLocaleString() : ""; }

  var role = Verifo.role();
  var isStaff = role === "ADMIN" || role === "OPERATOR";
  var references = [];
  var verifications = [];
  var selected = null;
  var busy = false;

  Verifo.bootstrap().then(function () {
    var btn = $("submit-btn");
    btn.addEventListener("click", submit);

    Verifo.api("/references").then(function (r) {
      if (r.ok && r.body && r.body.references) {
        references = r.body.references;
        var sel = $("ref-select");
        references.forEach(function (ref) {
          var o = document.createElement("option");
          o.value = ref.id;
          o.textContent = ref.title + " (" + ref.ref_code + ")";
          sel.appendChild(o);
        });
      }
    });
    refresh();
  }).catch(function () {});

  function refresh() {
    return Verifo.api("/verifications").then(function (r) {
      if (r.ok && r.body) {
        verifications = r.body.verifications || [];
        renderList();
      }
    });
  }

  function renderList() {
    $("results-count").textContent = verifications.length + " submission(s)";
    var ul = $("results-list");
    ul.innerHTML = "";
    var empty = $("results-empty");
    if (verifications.length === 0) {
      empty.textContent = "No verifications yet. Upload a document to see scored results here.";
      return;
    }
    empty.textContent = "";
    verifications.forEach(function (v) {
      var li = document.createElement("li");
      li.style.cssText = "border-top:1px solid var(--gray-100)";
      var row = document.createElement("button");
      row.type = "button";
      row.className = "list-row" + (selected && selected.id === v.id ? " on" : "");
      var side = '<span style="display:flex;gap:0.5rem;align-items:center;margin-left:auto">' +
        '<span style="font-weight:700;color:var(--gray-700)">' + (v.score != null ? Math.round(v.score) : "—") + "</span>" +
        Verifo.statusBadge(v.status) + "</span>";
      row.innerHTML =
        '<div style="min-width:0">' +
        '<p class="row-title">' + esc(v.filename) + "</p>" +
        '<p class="row-sub">' + fmt(v.created_at) + "</p></div>" + side;
      row.addEventListener("click", function () { pick(v); });
      li.appendChild(row);
      ul.appendChild(li);
    });
  }

  function pick(v) {
    var panel = $("detail-panel");
    panel.innerHTML = '<div class="spinner"><span class="dot"></span>Loading results…</div>';
    Verifo.api("/verifications/" + v.id).then(function (r) {
      selected = r.ok && r.body ? r.body.verification : v;
      renderDetail();
      renderList();
    }).catch(function () {
      selected = v;
      renderDetail();
    });
  }

  function renderDetail() {
    var panel = $("detail-panel");
    if (!selected) {
      panel.innerHTML = '<div class="card"><div class="card-body"><div class="empty"><h3>Select a result to inspect</h3>' +
        "<p>Choose a submission on the left to see its score breakdown, field conclusions, evidence, and the operator decision panel.</p>" +
        "</div></div></div>";
      return;
    }
    var v = selected;
    var bd = v.breakdown || {};
    var parts = [
      ["Readability (OCR / extraction)", bd.ocr],
      ["Template match (reference comparison)", bd.reference],
      ["Registry match (library lookup)", bd.database],
      ["Tamper signals (integrity heuristics)", bd.integrity],
    ];
    var score = v.score != null ? v.score : 0;
    var vMin = v.thresholds && v.thresholds.verified_min ? v.thresholds.verified_min : 80;
    var rMin = v.thresholds && v.thresholds.review_min ? v.thresholds.review_min : 50;
    var verdict = score >= vMin
      ? "Strong evidence of authenticity. The checks broadly agree with a genuine document — approve once identity, records and reference line up."
      : score >= rMin
        ? "Ambiguous evidence. Some signals don't line up, so an operator should review the flagged items before deciding."
        : "Weak evidence of authenticity. Several checks failed — treat as likely counterfeit until an operator clears it.";

    var lowest = parts.reduce(function (a, b) {
      var av = a[1] == null ? Infinity : a[1];
      var bv = b[1] == null ? Infinity : b[1];
      return av <= bv ? a : b;
    }, parts[0]);
    var reason = lowest[0].indexOf("Readability") === 0
      ? "the document could not be read cleanly"
      : lowest[0].indexOf("Template") === 0
        ? "the layout did not match the trusted template"
        : lowest[0].indexOf("Registry") === 0
          ? "the registry records did not agree"
          : "forensic scans found signs of tampering";

    var partBars = parts.map(function (p) {
      var val = p[1] == null ? 0 : Math.round(p[1]);
      return '<div><div class="flex items-center justify-between" style="font-size:0.8125rem">' +
        '<span style="font-weight:500;color:var(--gray-600)">' + esc(p[0]) + "</span>" +
        '<span style="font-weight:700;color:var(--gray-700)">' + (p[1] == null ? "—" : val) + "</span></div>" +
        '<div class="progress" style="margin-top:0.25rem"><div style="width:' + Math.min(100, val) + '%"></div></div></div>';
    }).join("");

    var ring = '<div class="score-ring" style="background:conic-gradient(var(--brand-600) ' + Math.min(360, Math.round(score * 3.6)) + 'deg, var(--gray-100) 0deg)"><div>' + Math.round(score) + "</div></div>";

    var html = '<div class="card"><div class="card-body">' +
      '<div class="flex items-start justify-between gap-3 flex-wrap">' +
      '<div><h2 style="font-size:1rem">' + esc(v.filename) + "</h2>" +
      '<p class="text-sm text-muted" style="margin-top:0.25rem">' +
      (v.reference
        ? "Compared against " + esc(v.reference.title) + " (" + esc(v.reference.ref_code) + ")"
        : "No explicit reference selected") + "</p></div>" +
      '<div style="display:flex;gap:0.375rem;align-items:center">' +
      Verifo.statusBadge(v.status) + (v.decision ? Verifo.statusBadge(v.decision) : "") + "</div></div>" +
      (v.download_token
        ? '<a style="display:inline-block;margin-top:0.5rem;font-size:0.8125rem;font-weight:600;color:var(--brand-600)" href="/api/v1/downloads/' + esc(v.download_token) + '">Download submitted file</a>'
        : "") +
      '<div class="flex-wrap" style="display:flex;align-items:flex-end;justify-content:space-between;gap:1.25rem;margin-top:1.5rem">' +
      ring +
      '<div class="flex-1" style="min-width:220px;display:flex;flex-direction:column;gap:0.625rem">' + partBars + "</div></div>" +
      '<div class="card" style="margin-top:1.25rem;background:var(--brand-50);border:1px solid var(--brand-100);box-shadow:none">' +
      '<div class="card-body"><p style="font-size:0.6875rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--brand-700)">Score explained</p>' +
      '<p class="text-sm" style="margin-top:0.375rem;line-height:1.6;color:var(--gray-700)">' + verdict + "</p>" +
      (score < vMin && (lowest[1] == null ? Infinity : lowest[1]) < score
        ? '<p class="text-xs" style="margin-top:0.375rem;color:var(--gray-500)">Main reason for the lower score: <b>' + reason + "</b> (" + Math.round(lowest[1]) + "/100).</p>"
        : "") +
      "</div></div></div></div>";

    if (v.conclusion && v.conclusion.length > 0) {
      html += '<div class="card" style="margin-top:1.25rem"><div class="card-header"><div><h2>Field &amp; finding signals</h2></div></div>' +
        '<div class="card-body"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0.625rem">' +
        v.conclusion.map(function (c) {
          return '<li class="flex items-start justify-between gap-2" style="border:1px solid var(--gray-200);border-radius:0.5rem;padding:0.625rem 0.875rem;font-size:0.8125rem">' +
            '<div><p style="font-weight:600;color:var(--gray-700)">' + esc(c.finding || c.key) + "</p>" +
            (c.reference
              ? '<p class="text-xs text-muted" style="margin-top:0.125rem">reference: <span class="mono">' + esc(c.reference) + "</span> · submitted: <span class='mono'>" + esc(c.submitted) + "</span></p>"
              : "") + "</div>" +
            Verifo.statusBadge((c.status || "").toUpperCase()) + "</li>";
        }).join("") + "</ul></div></div>";
    }

    if (v.evidence && v.evidence.length > 0) {
      html += '<div class="card" style="margin-top:1.25rem"><div class="card-header"><div><h2>Evidence</h2></div></div>' +
        '<div class="card-body"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0.375rem">' +
        v.evidence.map(function (e) {
          return '<li class="text-sm" style="display:flex;gap:0.5rem;color:var(--gray-600)"><span style="margin-top:0.375rem;width:0.375rem;height:0.375rem;border-radius:9999px;background:var(--brand-600);flex:none"></span>' + esc(e) + "</li>";
        }).join("") + "</ul></div></div>";
    }

    var reviewable = v.status === "REVIEW" || v.status === "VERIFIED";
    if (reviewable && isStaff) {
      html += '<div class="card" style="margin-top:1.25rem"><div class="card-body">' +
        "<h3 style=\"font-size:0.9375rem\">Operator decision</h3>" +
        '<div class="split-2-3" style="margin-top:0.875rem;gap:0.75rem">' +
        '<select class="input" id="decision-select"><option value="">Choose decision…</option>' +
        '<option value="VERIFIED">VERIFIED — accept</option><option value="REJECTED">REJECTED — reject</option></select>' +
        '<input class="input" id="decision-comment" placeholder="Add a comment for the audit trail…"></div>' +
        '<div id="decision-msg" style="margin-top:0.5rem"></div>' +
        '<div class="flex items-center gap-3" style="margin-top:0.875rem">' +
        '<button type="button" class="btn btn-primary" id="decision-btn">Record decision</button>' +
        (v.decision ? '<span class="text-xs text-muted">Last decision: ' + esc(v.decision) + "</span>" : "") +
        "</div></div></div>";
    }

    panel.innerHTML = html;

    if (reviewable && isStaff) {
      $("decision-btn").addEventListener("click", submitDecision);
    }
  }

  function submitDecision() {
    if (busy) return;
    var decision = $("decision-select").value;
    var comment = $("decision-comment").value.trim();
    if (!decision) return;
    var sensitive = decision === "REJECTED" || (selected.score != null && selected.score < 80);
    if (sensitive && !comment) {
      $("decision-msg").innerHTML = '<p class="alert alert-error">A comment is required for rejections and low scores.</p>';
      return;
    }
    busy = true;
    $("decision-btn").disabled = true;
    Verifo.api("/verifications/" + selected.id + "/decision", { method: "POST", body: { decision: decision, comment: comment } })
      .then(function (r) {
        if (r.ok) {
          $("decision-msg").innerHTML = '<p class="alert alert-ok">Decision recorded and audited.</p>';
          refresh().then(function () { if (selected) pick({ id: selected.id }); });
        } else {
          $("decision-msg").innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Could not record decision.") + "</p>";
        }
      })
      .finally(function () { busy = false; $("decision-btn").disabled = false; });
  }

  function submit() {
    var file = $("file-input").files[0];
    var msg = $("submit-msg");
    if (!file) {
      msg.innerHTML = '<p class="alert alert-error">Choose a file first.</p>';
      return;
    }
    busy = true;
    $("submit-btn").disabled = true;
    var fd = new FormData();
    fd.append("file", file);
    var refId = $("ref-select").value;
    if (refId) fd.append("reference_id", refId);
    Verifo.upload("/verifications", fd).then(function (r) {
      if (r.ok) {
        msg.innerHTML = '<p class="alert alert-ok">Submitted — the worker is processing it now.</p>';
        $("file-input").value = "";
        refresh();
      } else {
        msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Upload failed.") + "</p>";
      }
    }).catch(function () {
      msg.innerHTML = '<p class="alert alert-error">Network error during upload.</p>';
    }).finally(function () { busy = false; $("submit-btn").disabled = false; });
  }
})();