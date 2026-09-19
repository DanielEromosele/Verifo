/* References page: library list, search, detail, publish + archive (admin). */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Verifo.esc(s); }
  function fmt(d) { return d ? new Date(d).toLocaleString() : ""; }

  var role = Verifo.role();
  var isAdmin = role === "ADMIN";
  var references = [];
  var types = [];
  var selected = null;

  Verifo.bootstrap().then(function () {
    if (isAdmin) $("create-slot").appendChild(createForm());
    var search = $("search");
    search.addEventListener("input", function () { renderList(); });
    Promise.all([Verifo.api("/references"), Verifo.api("/document-types")]).then(function (res) {
      if (res[0].ok && res[0].body) references = res[0].body.references || [];
      if (res[1].ok && res[1].body) types = res[1].body.document_types || [];
      renderList();
    });
  }).catch(function () {});

  function renderList() {
    var q = $("search").value.trim().toLowerCase();
    var filtered = references.filter(function (r) {
      return (r.title + " " + (r.ref_code || "") + " " + (r.filename || "")).toLowerCase().indexOf(q) !== -1;
    });
    $("lib-count").textContent = filtered.length + " reference(s)";
    var ul = $("ref-list");
    ul.innerHTML = "";
    var empty = $("refs-empty");
    if (filtered.length === 0) {
      empty.textContent = "No references yet. Publish a trusted copy to begin — it becomes the base of comparison for every screening.";
      renderEmptyDetail();
      return;
    }
    empty.textContent = "";
    filtered.forEach(function (r) {
      var li = document.createElement("li");
      li.style.cssText = "border-top:1px solid var(--gray-100)";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "list-row" + (selected && selected.id === r.id ? " on" : "");
      b.style.cssText = b.style.cssText + ";flex-direction:column;align-items:stretch;padding:0.75rem 1.25rem";
      b.innerHTML =
        '<span style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center;width:100%">' +
        '<span class="row-title" style="display:block;overflow:hidden;text-overflow:ellipsis">' + esc(r.title) + "</span>" +
        Verifo.statusBadge(r.status) + "</span>" +
        '<span class="row-sub" style="display:block;margin-top:0.25rem">' + esc(r.ref_code) + " · " +
        esc((r.document_type && r.document_type.code) || "REF") + " · " + ((r.extracted_fields || []).length) + " field(s)</span>";
      b.addEventListener("click", function () { openRef(r); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function openRef(r) {
    var panel = $("ref-detail");
    panel.innerHTML = '<div class="spinner"><span class="dot"></span>Loading…</div>';
    Verifo.api("/references/" + r.id).then(function (res) {
      selected = res.ok && res.body ? res.body.reference : r;
      renderDetail();
      renderList();
    }).catch(function () {
      selected = r;
      renderDetail();
    });
  }

  function renderDetail() {
    var panel = $("ref-detail");
    if (!selected) {
      panel.innerHTML = '<div class="card"><div class="card-body"><div class="empty"><h3>Select a reference</h3>' +
        "<p>Open a reference to inspect its fingerprint, embedded fields, and producer baseline.</p></div></div></div>";
      return;
    }
    var r = selected;
    var fields = r.fields || [];
    var html = '<div class="card"><div class="card-body">' +
      '<div class="flex items-start justify-between gap-3 flex-wrap">' +
      '<div><h2 style="font-size:1rem">' + esc(r.title) + "</h2>" +
      '<p class="text-xs text-muted" style="margin-top:0.25rem">' + esc(r.ref_code) + " · " +
      esc((r.document_type && r.document_type.name) || "Generic") + " · uploaded " + fmt(r.created_at) + "</p>" +
      '<div class="flex" style="gap:0.375rem;margin-top:0.625rem">' +
      Verifo.statusBadge(r.status) +
      '<span class="badge badge-neutral">checksum ' + esc((r.fingerprint && r.fingerprint.sha256 || "…").slice(0, 12)) + "</span></div></div>" +
      '<div class="flex" style="gap:0.5rem">' +
      (r.download_token
        ? '<a class="btn btn-secondary btn-sm" href="/api/v1/downloads/' + esc(r.download_token) + '">Download copy</a>'
        : "") +
      (selected.status === "ACTIVE"
        ? '<button type="button" class="btn btn-secondary btn-sm" id="ref-status-btn">Archive</button>'
        : '<button type="button" class="btn btn-secondary btn-sm" id="ref-status-btn">Reactivate</button>') +
      "</div></div>" +
      (r.baseline && r.baseline.producer
        ? '<div class="card" style="background:var(--gray-50);border:1px solid var(--gray-200);box-shadow:none;margin-top:1.25rem">' +
          '<div class="card-body"><p style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--gray-500)">Producer baseline</p>' +
          '<pre class="mono text-xs" style="margin:0.5rem 0 0;color:var(--gray-700);overflow:auto;max-height:10rem">' + esc(JSON.stringify(r.baseline, null, 2)) + "</pre></div></div>"
        : "") +
      '<h3 style="font-size:0.875rem;margin-top:1.25rem">Extracted fields</h3>' +
      '<div class="table-wrap" style="margin-top:0.625rem"><table class="v-table"><thead><tr><th>Field</th><th>Confidence</th><th>Value</th></tr></thead>' +
      '<tbody>' +
      fields.map(function (f) {
        return "<tr><td style=\"font-weight:500;color:var(--gray-700)\">" + esc(f.key || f.field) + "</td>" +
          "<td>" + (f.confidence != null ? Math.round(f.confidence * 100) + "%" : "—") + "</td>" +
          '<td class="mono text-xs" style="color:var(--gray-500);max-width:18rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(String(f.value != null ? f.value : f.raw || "")).slice(0, 120) + "</td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      (fields.length === 0 ? '<p class="text-sm text-muted" style="text-align:center;padding:1.5rem 0">No fields extracted from this reference.</p>' : "") +
      "</div></div>";

    panel.innerHTML = html;
    var btn = $("ref-status-btn");
    if (btn) btn.addEventListener("click", function () { toggleStatus(); });
  }

  function toggleStatus() {
    var next = selected.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    Verifo.api("/references/" + selected.id, { method: "PATCH", body: { status: next } }).then(function (r) {
      if (r.ok && r.body) {
        selected = r.body.reference;
        for (var i = 0; i < references.length; i++) {
          if (references[i].id === selected.id) references[i] = selected;
        }
        renderDetail();
        renderList();
      }
    });
  }

  function renderEmptyDetail() {
    $("ref-detail").innerHTML = '<div class="card"><div class="card-body"><div class="empty"><h3>Select a reference</h3>' +
      "<p>Open a reference to inspect its fingerprint, embedded fields, and producer baseline.</p></div></div></div>";
  }

  function createForm() {
    var wrap = document.createElement("div");
    wrap.className = "create-card";
    wrap.innerHTML =
      "<h3>Publish reference</h3>" +
      '<input class="input" id="ref-title" placeholder="Reference title" style="margin-bottom:0.625rem">' +
      '<select class="input" id="ref-type" style="margin-bottom:0.625rem"><option value="">Generic document</option></select>' +
      '<input type="file" id="ref-file" class="input" accept=".pdf,.png,.jpg,.jpeg" style="margin-bottom:0.625rem">' +
      '<div id="ref-msg"></div>' +
      '<button type="button" class="btn btn-primary" id="ref-create" style="width:100%;margin-top:0.375rem">Process &amp; publish</button>';
    var typeSel = wrap.querySelector("#ref-type");
    types.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name + " (" + t.code + ")";
      typeSel.appendChild(o);
    });
    var createBtn = wrap.querySelector("#ref-create");
    createBtn.addEventListener("click", function () {
      var msg = wrap.querySelector("#ref-msg");
      var title = wrap.querySelector("#ref-title").value.trim();
      var file = wrap.querySelector("#ref-file").files[0];
      if (!title) { msg.innerHTML = '<p class="alert alert-error">A title is required.</p>'; return; }
      if (!file) { msg.innerHTML = '<p class="alert alert-error">Choose a reference file.</p>'; return; }
      createBtn.disabled = true;
      var fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      var tid = wrap.querySelector("#ref-type").value;
      if (tid) fd.append("document_type_id", tid);
      Verifo.upload("/references", fd).then(function (r) {
        if (r.ok) {
          msg.innerHTML = '<p class="alert alert-ok">Reference processed and added to the library.</p>';
          wrap.querySelector("#ref-title").value = "";
          wrap.querySelector("#ref-file").value = "";
          Verifo.api("/references").then(function (res) {
            if (res.ok && res.body) { references = res.body.references || []; renderList(); }
          });
        } else {
          msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Upload failed.") + "</p>";
        }
      }).catch(function () { msg.innerHTML = '<p class="alert alert-error">Network error.</p>'; })
        .finally(function () { createBtn.disabled = false; });
    });
    return wrap;
  }
})();