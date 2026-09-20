/* My Results page: table of the current user's submissions with a detail modal. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Verifo.esc(s); }
  function fmt(d) { return d ? new Date(d).toLocaleString() : ""; }

  var verifications = [];
  var selected = null;
  var busy = false;

  Verifo.bootstrap().then(function () {
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
    var tbody = $("results-rows");
    tbody.innerHTML = "";
    var empty = $("results-empty");
    if (verifications.length === 0) {
      empty.style.display = "";
      empty.textContent = "No submissions yet. Upload a document from the Upload page to see results here.";
      return;
    }
    empty.style.display = "none";
    verifications.forEach(function (v) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="truncate" style="max-width:280px">' + esc(v.filename) + "</td>" +
        "<td>" + Verifo.statusBadge(v.status) + "</td>" +
        '<td style="font-weight:700;color:var(--gray-700)">' + (v.score != null ? Math.round(v.score) : "—") + "</td>" +
        "<td>" + (v.decision ? Verifo.statusBadge(v.decision) : '<span class="text-xs text-muted">pending</span>') + "</td>" +
        '<td><button type="button" class="btn btn-ghost btn-sm">View</button></td>';
      tr.querySelector("button").addEventListener("click", function () { pick(v); });
      tbody.appendChild(tr);
    });
  }

  function pick(v) {
    var body = $("modal-body");
    body.innerHTML = '<div class="spinner"><span class="dot"></span>Loading results…</div>';
    $("detail-modal").style.display = "flex";
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
    var body = $("modal-body");
    if (!selected) return;
    var v = selected;
    $("modal-title").textContent = v.filename;

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

    var verdict;
    if (v.status === "VERIFIED") {
      verdict = "Verified. The document is accepted as authentic.";
    } else if (v.status === "REJECTED") {
      verdict = "Rejected. The document was not accepted." + (v.decision_comment ? " Operator note: " + v.decision_comment : "");
    } else if (score >= vMin) {
      verdict = "Strong evidence of authenticity, pending operator review.";
    } else if (score >= rMin) {
      verdict = "Ambiguous evidence — an operator is reviewing the flagged items.";
    } else {
      verdict = "Weak evidence of authenticity — an operator should review this document.";
    }

    var partBars = parts.map(function (p) {
      var val = p[1] == null ? 0 : Math.round(p[1]);
      return '<div><div class="flex items-center justify-between" style="font-size:0.8125rem">' +
        '<span style="font-weight:500;color:var(--gray-600)">' + esc(p[0]) + "</span>" +
        '<span style="font-weight:700;color:var(--gray-700)">' + (p[1] == null ? "—" : val) + "</span></div>" +
        '<div class="progress" style="margin-top:0.25rem"><div style="width:' + Math.min(100, val) + '%"></div></div></div>';
    }).join("");

    var ring = '<div class="score-ring" style="background:conic-gradient(var(--brand-600) ' + Math.min(360, Math.round(score * 3.6)) + 'deg, var(--gray-100) 0deg)"><div>' + Math.round(score) + "</div></div>";

    var html =
      '<div class="flex items-start justify-between gap-3 flex-wrap" style="margin-bottom:1.25rem">' +
      '<div><p class="text-sm text-muted">' + fmt(v.created_at) + "</p>" +
      (v.download_token
        ? '<a style="font-size:0.8125rem;font-weight:600;color:var(--brand-600)" href="/api/v1/downloads/' + esc(v.download_token) + '">Download submitted file</a>'
        : "") +
      "</div>" + Verifo.statusBadge(v.status) + "</div>" +
      '<div class="flex-wrap" style="display:flex;align-items:flex-end;justify-content:space-between;gap:1.25rem">' +
      ring +
      '<div class="flex-1" style="min-width:220px;display:flex;flex-direction:column;gap:0.625rem">' + partBars + "</div></div>" +
      '<div class="card" style="margin-top:1.25rem;background:var(--brand-50);border:1px solid var(--brand-100);box-shadow:none">' +
      '<div class="card-body"><p style="font-size:0.6875rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--brand-700)">Result</p>' +
      '<p class="text-sm" style="margin-top:0.375rem;line-height:1.6;color:var(--gray-700)">' + esc(verdict) + "</p></div></div>";

    if (v.conclusion && v.conclusion.length > 0) {
      html += '<ul class="mt" style="list-style:none;margin:1.25rem 0 0;padding:0;display:flex;flex-direction:column;gap:0.625rem">' +
        v.conclusion.map(function (c) {
          return '<li class="flex items-start justify-between gap-2" style="border:1px solid var(--gray-200);border-radius:0.5rem;padding:0.625rem 0.875rem;font-size:0.8125rem">' +
            '<div><p style="font-weight:600;color:var(--gray-700)">' + esc(c.finding || c.key) + "</p>" +
            (c.submitted
              ? '<p class="text-xs text-muted" style="margin-top:0.125rem">submitted: <span class="mono">' + esc(c.submitted) + "</span></p>"
              : "") + "</div>" +
            Verifo.statusBadge((c.status || "").toUpperCase()) + "</li>";
        }).join("") + "</ul>";
    }

    if (v.issues && v.issues.length > 0) {
      html += '<div class="card" style="margin-top:1.25rem"><div class="card-header"><div><h2>Items flagged for review</h2></div></div>' +
        '<div class="card-body"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0.375rem">' +
        v.issues.map(function (i) {
          return '<li class="text-sm" style="display:flex;gap:0.5rem;color:var(--gray-600)"><span style="margin-top:0.375rem;width:0.375rem;height:0.375rem;border-radius:9999px;background:var(--danger-500);flex:none"></span>' + esc(i.message || i.finding) + "</li>";
        }).join("") + "</ul></div></div>";
    }

    body.innerHTML = html;
  }

  $("modal-close").addEventListener("click", closeModal);
  $("detail-modal").addEventListener("click", function (e) {
    if (e.target.classList.contains("modal-overlay")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  function closeModal() {
    $("detail-modal").style.display = "none";
    selected = null;
  }
})();