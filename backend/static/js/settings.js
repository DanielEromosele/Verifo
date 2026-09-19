/* Settings page: config, team, API keys, audit log (admin). */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Verifo.esc(s); }
  function fmtDate(s) { return s ? new Date(s).toLocaleDateString() : ""; }
  function fmtDT(s) { return s ? new Date(s).toLocaleString() : ""; }

  var role = Verifo.role();
  var isAdmin = role === "ADMIN";
  var isStaff = role === "ADMIN" || role === "OPERATOR";
  var tab = "config";

  Verifo.bootstrap().then(function () {
    var tabsWrap = $("settings-tabs");
    if (!isStaff) {
      tabsWrap.hidden = true;
      $("tab-noaccess").hidden = false;
      return;
    }
    tabsWrap.querySelectorAll(".tab-pill").forEach(function (b) {
      b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
    });
    if (!isAdmin) {
      tabsWrap.querySelectorAll(".tab-pill").forEach(function (b) {
        b.hidden = b.getAttribute("data-tab") !== "team";
      });
      switchTab("team");
      return;
    }
    loadConfig();
    switchTab("config");
  }).catch(function () {});

  function switchTab(name) {
    tab = name;
    var tabsWrap = $("settings-tabs");
    tabsWrap.querySelectorAll(".tab-pill").forEach(function (b) {
      b.className = "tab-pill " + (b.getAttribute("data-tab") === name ? "on" : "off");
    });
    ["config", "team", "keys", "audit"].forEach(function (t) {
      $( "tab-" + t).hidden = t !== name;
    });
    if (name === "config") loadConfig();
    if (name === "team") loadTeam();
    if (name === "keys") loadKeys();
    if (name === "audit") loadAudit();
  }

  /* ---------- Configuration ---------- */

  var SETTINGS = null;

  function loadConfig() {
    Verifo.api("/admin/settings").then(function (r) {
      if (!r.ok || !r.body) return;
      SETTINGS = r.body.settings;
      renderConfig();
    });
  }

  function renderConfig() {
    var s = SETTINGS;
    var w = s.weights || {};
    var t = s.thresholds || {};
    var META = {
      ocr: ["Readability", "How reliably the document could be read. Blurry scans or bad quality pull this down."],
      database: ["Registry match", "Does the issuing office's own records agree? Full agreement = 100, no record found = 0."],
      reference: ["Template match", "How closely layout, typography and seal line up with your trusted reference original."],
      integrity: ["Tamper signals", "Forensic scan for edits — metadata rewrites, cloned pixels, seal shifts. Lower = more suspicious."],
    };
    var keys = ["ocr", "database", "reference", "integrity"];
    var weights = {};
    keys.forEach(function (k) { weights[k] = w[k] != null ? w[k] : { ocr: 0.35, database: 0.25, reference: 0.25, integrity: 0.15 }[k]; });
    var thresholds = {
      verified_min: t.verified_min != null ? t.verified_min : 80,
      review_min: t.review_min != null ? t.review_min : 50,
    };
    var requiredFields = (s.required_fields || []).slice();

    var html = '<div class="card">';
    html += '<div class="card-header"><div><h2>Verification scoring</h2><p>Every document gets four independent checks, blended by the weights below.</p></div></div>';
    html += '<div class="card-body">';
    html += '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))">';
    keys.forEach(function (k) {
      html += '<div style="border:1px solid var(--gray-200);border-radius:10px;padding:1rem">' +
        '<div class="flex items-center justify-between"><span style="font-weight:700;font-size:0.875rem;color:var(--gray-900)">' + META[k][0] + "</span>" +
        '<span class="badge badge-brand" id="w-chip-' + k + '">' + Math.round(weights[k] * 100) + "%</span></div>" +
        '<p class="text-xs text-muted" style="margin:0.5rem 0 0.75rem;line-height:1.5">' + META[k][1] + "</p>" +
        '<input type="number" step="5" min="0" max="100" class="input" id="w-' + k + '" value="' + Math.round(weights[k] * 100) + '"></div>';
    });
    html += "</div>";
    html += '<div class="split-2col" style="margin-top:1rem;gap:1rem">' +
      '<div><label class="label">Verified threshold (0–100)</label><input type="number" min="0" max="100" class="input" id="t-verified" value="' + thresholds.verified_min + '">' +
      '<p class="text-xs text-muted" style="margin-top:0.25rem">Score at or above this = clear to approve without human review.</p></div>' +
      '<div><label class="label">Review threshold (0–100)</label><input type="number" min="0" max="100" class="input" id="t-review" value="' + thresholds.review_min + '">' +
      '<p class="text-xs text-muted" style="margin-top:0.25rem">Between this and the verified threshold = an operator must decide.</p></div>' +
      "</div>";
    html += '<div style="margin-top:1.25rem"><label class="label">Required fields (document metadata)</label>' +
      '<div class="flex" style="gap:0.5rem"><input class="input flex-1" id="field-input" placeholder="e.g. student_full_name">' +
      '<button type="button" class="btn btn-secondary" id="field-add">Add</button></div>' +
      '<p class="text-xs text-muted" style="margin-top:0.25rem">Metadata the document must contain. If any are missing, the result tells the operator exactly which one.</p>' +
      '<div class="flex flex-wrap" id="field-chips" style="gap:0.375rem;margin-top:0.625rem"></div></div>';
    html += '<div id="config-msg" style="margin-top:0.75rem"></div>';
    html += '<button type="button" class="btn btn-primary" id="config-save" style="margin-top:1rem">Save configuration</button>';
    html += "</div></div>";

    html += '<div class="card" style="margin-top:1.25rem;background:var(--brand-50);border-color:var(--brand-100);box-shadow:none">' +
      '<div class="card-body"><h3 style="font-size:0.875rem">How does scoring work? (worked example)</h3>' +
      '<p class="text-xs text-muted" style="margin-top:0.5rem;line-height:1.6">' +
      'Take a typical submission: <b>readability 95</b>, <b>registry 100</b>, <b>template 91</b>, <b>tamper signals 60</b>. Applying your current weights:</p>' +
      '<div class="flex flex-wrap items-center" style="gap:0.5rem;margin-top:0.75rem">' +
      '<code class="mono text-xs" style="background:#fff;border:1px solid var(--brand-200);border-radius:8px;padding:0.375rem 0.625rem" id="example-formula"></code>' +
      '<b id="example-score" style="color:var(--gray-900)"></b>' +
      '<span id="example-band"></span><span class="text-xs text-muted" id="example-detail"></span></div>' +
      '<div id="example-bar" class="progress" style="height:0.5rem;margin-top:1rem"></div>' +
      '<div class="flex justify-between text-xs text-muted" style="margin-top:0.375rem">' +
      '<span>0 · flagged</span><span id="prog-review">' + thresholds.review_min + " · review</span>" +
      '<span id="prog-verified">' + thresholds.verified_min + " · verified</span><span>100</span></div>" +
      '<p class="text-xs text-muted" style="margin-top:0.625rem" id="example-note"></p>' +
      "</div></div>";

    $("tab-config").hidden = true;
    $("tab-config").hidden = false;
    $("tab-config").innerHTML = html;

    renderFields();
    updateExample();

    keys.forEach(function (k) {
      $("w-" + k).addEventListener("input", function () {
        weights[k] = Math.round((Number($( "w-" + k).value) || 0)) / 100;
        var niced = Object.assign({}, weights);
        niced.integrity = Math.max(0, Math.min(1, 1 - niced.ocr - niced.database - niced.reference));
        $("w-chip-" + k).textContent = Math.round(niced[k] * 100) + "%";
        updateExample();
      });
    });
    $("t-verified").addEventListener("input", function () { thresholds.verified_min = Number($("t-verified").value); updateExample(); });
    $("t-review").addEventListener("input", function () { thresholds.review_min = Number($("t-review").value); updateExample(); });

    $("field-add").addEventListener("click", function () {
      var v = $("field-input").value.trim();
      if (v && requiredFields.indexOf(v) === -1) requiredFields.push(v);
      $("field-input").value = "";
      renderFields();
    });

    $("config-save").addEventListener("click", function () {
      var msg = $("config-msg");
      var niced = Object.assign({}, weights);
      niced.integrity = Math.max(0, Math.min(1, 1 - niced.ocr - niced.database - niced.reference));
      var sum = niced.ocr + niced.database + niced.reference + niced.integrity;
      if (Math.abs(sum - 1) > 0.01) {
        msg.innerHTML = '<p class="alert alert-error">Weights must sum to exactly 1.</p>';
        return;
      }
      if (thresholds.review_min > thresholds.verified_min) {
        msg.innerHTML = '<p class="alert alert-error">Review threshold can\'t exceed the verified threshold.</p>';
        return;
      }
      $("config-save").disabled = true;
      Verifo.api("/admin/settings", {
        method: "PUT",
        body: { weights: niced, thresholds: thresholds, required_fields: requiredFields },
      }).then(function (r) {
        if (r.ok) {
          msg.innerHTML = '<p class="alert alert-ok">Configuration saved and audited.</p>';
        } else {
          msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Save failed.") + "</p>";
        }
      }).finally(function () { $("config-save").disabled = false; });
    });

    function renderFields() {
      var chips = $("field-chips");
      chips.innerHTML = "";
      requiredFields.forEach(function (f) {
        var tag = document.createElement("span");
        tag.className = "badge badge-brand";
        tag.style.gap = "0.375rem";
        tag.innerHTML = esc(f) + '<button type="button" style="border:none;background:none;color:inherit;cursor:pointer;font-size:0.875rem;line-height:1" title="Remove">×</button>';
        tag.querySelector("button").addEventListener("click", function () {
          requiredFields = requiredFields.filter(function (x) { return x !== f; });
          renderFields();
        });
        chips.appendChild(tag);
      });
    }

    function updateExample() {
      var niced = Object.assign({}, weights);
      niced.integrity = Math.max(0, Math.min(1, 1 - niced.ocr - niced.database - niced.reference));
      var EXAMPLE = { ocr: 95, database: 100, reference: 91, integrity: 60 };
      var score = Math.round(
        EXAMPLE.ocr * niced.ocr + EXAMPLE.database * niced.database + EXAMPLE.reference * niced.reference + EXAMPLE.integrity * niced.integrity
      );
      var band, detail, cls;
      if (score >= (thresholds.verified_min || 80)) {
        band = "VERIFIED"; detail = "clear to approve"; cls = "badge badge-ok";
      } else if (score >= (thresholds.review_min || 50)) {
        band = "REVIEW"; detail = "send to a human"; cls = "badge badge-warn";
      } else {
        band = "REJECTED"; detail = "likely counterfeit"; cls = "badge badge-bad";
      }
      var biggestKey = ["ocr", "database", "reference", "integrity"].reduce(function (a, b) { return niced[b] >= niced[a] ? b : a; }, "ocr");
      $("example-formula").textContent =
        "(95×" + niced.ocr.toFixed(2) + ") + (100×" + niced.database.toFixed(2) + ") + (91×" + niced.reference.toFixed(2) + ") + (60×" + niced.integrity.toFixed(2) + ")";
      $("example-score").textContent = "= " + score + "/100";
      $("example-band").innerHTML = '<span class="' + cls + '">' + band + "</span>";
      $("example-detail").textContent = "— " + detail;
      var vm = thresholds.verified_min || 80;
      var rm = thresholds.review_min || 50;
      $("example-bar").innerHTML =
        '<div style="width:' + rm + '%;background:var(--red-600);height:100%"></div>' +
        '<div style="width:' + Math.max(0, vm - rm) + '%;background:#f59e0b;height:100%"></div>' +
        '<div style="width:' + Math.max(0, 100 - vm) + '%;background:var(--green-600);height:100%"></div>';
      $("prog-review").textContent = rm + " · review";
      $("prog-verified").textContent = vm + " · verified";
      $("example-note").textContent = "This example lands at " + score + " → " + detail + ". Raising the " + META[biggestKey][0].toLowerCase() + " weight ("
        + biggestKey + ") moves the score most.";
    }
  }

  /* ---------- Team ---------- */

  function loadTeam() {
    Verifo.api("/users").then(function (r) {
      var users = r.ok && r.body ? r.body.users || [] : [];
      var html = '<div class="card"><div class="card-header"><div><h2>Team members</h2>' +
        (!isAdmin ? '<p class="text-xs text-muted">Read-only for operators.</p>' : "") + "</div>" +
        (isAdmin ? '<button type="button" class="btn btn-primary" id="invite-toggle" style="font-size:0.8125rem">Add member</button>' : "") + "</div>" +
        '<div id="invite-form" hidden style="border-bottom:1px solid var(--gray-100);background:var(--gray-50);padding:1rem 1.25rem">' +
        '<div class="split-2col" style="gap:0.625rem">' +
        '<input class="input" id="inv-name" placeholder="Full name">' +
        '<input class="input" id="inv-email" placeholder="Email" type="email">' +
        '<input class="input" id="inv-password" placeholder="Temporary password">' +
        '<select class="input" id="inv-role"><option value="OPERATOR">OPERATOR</option><option value="SUBMITTER">SUBMITTER</option><option value="ADMIN">ADMIN</option></select></div>' +
        '<div id="inv-msg" style="margin-top:0.5rem"></div>' +
        '<button type="button" class="btn btn-primary" id="invite-send" style="font-size:0.8125rem;margin-top:0.5rem">Invite</button></div>';
      html += '<div class="table-wrap"><table class="v-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Status</th>' +
        (isAdmin ? '<th class="text-right">Actions</th>' : "") + "</tr></thead><tbody>";
      users.forEach(function (m) {
        html += "<tr><td style=\"font-weight:500;color:var(--gray-700)\">" + esc((m.user && m.user.full_name) || "—") + "</td>" +
          '<td class="text-muted">' + esc((m.user && m.user.email) || "") + "</td>" +
          "<td>" + Verifo.statusBadge(m.role) + "</td>" +
          "<td>" + Verifo.statusBadge(m.status) + "</td>" +
          (isAdmin
            ? '<td class="text-right"><button type="button" class="btn btn-ghost btn-sm" data-id="' + esc(m.user && m.user.id) + '" ' +
              'data-status="' + (m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE") + '">' +
              (m.status === "ACTIVE" ? "Suspend" : "Activate") + "</button></td>"
            : "");
      });
      html += "</tbody></table></div></div>";
      $("tab-team").innerHTML = html;
      if (isAdmin) {
        $("invite-toggle").addEventListener("click", function () { $("invite-form").hidden = !$("invite-form").hidden; });
        $("invite-send").addEventListener("click", sendInvite);
        $("tab-team").querySelectorAll("button[data-id]").forEach(function (b) {
          b.addEventListener("click", function () {
            Verifo.api("/admin/users/" + b.getAttribute("data-id") + "/status", {
              method: "POST", body: { status: b.getAttribute("data-status") },
            }).then(function () { loadTeam(); });
          });
        });
      }
    });
  }

  function sendInvite() {
    var msg = $("inv-msg");
    $("invite-send").disabled = true;
    Verifo.api("/users/invite", {
      method: "POST",
      body: {
        email: $("inv-email").value.trim(),
        full_name: $("inv-name").value.trim(),
        role: $("inv-role").value,
        password: $("inv-password").value,
      },
    }).then(function (r) {
      if (r.ok) {
        $("invite-form").hidden = true;
        msg.innerHTML = '<p class="alert alert-ok">Member added.</p>';
        loadTeam();
      } else {
        msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Invite failed.") + "</p>";
      }
    }).finally(function () { $("invite-send").disabled = false; });
  }

  /* ---------- API keys ---------- */

  function loadKeys() {
    Verifo.api("/api-keys").then(function (r) {
      var keys = r.ok && r.body ? r.body.api_keys || [] : [];
      var html = '<div class="card"><div class="card-header"><div><h2>API keys</h2></div>' +
        '<button type="button" class="btn btn-primary" id="key-toggle" style="font-size:0.8125rem">New key</button></div>' +
        '<div id="secret-box" hidden style="background:var(--amber-50);border-bottom:1px solid var(--amber-100);padding:1rem 1.25rem">' +
        '<p class="text-xs" style="font-weight:700;color:var(--amber-700)">Copy this secret now — it will never be shown again.</p>' +
        '<code class="mono" style="display:block;margin-top:0.5rem;background:#fff;border:1px solid var(--amber-200);border-radius:8px;padding:0.5rem 0.75rem;word-break:break-all" id="secret-value"></code></div>' +
        '<div id="key-form" hidden style="border-bottom:1px solid var(--gray-100);background:var(--gray-50);padding:1rem 1.25rem">' +
        '<div class="split-2col" style="gap:0.625rem">' +
        '<input class="input" id="key-name" placeholder="Key name (e.g. integrity-checker)">' +
        '<input class="input" id="key-ttl" type="number" min="1" max="3650" placeholder="TTL days (optional)"></div>' +
        '<div id="key-msg" style="margin-top:0.5rem"></div>' +
        '<button type="button" class="btn btn-primary" id="key-create" style="font-size:0.8125rem;margin-top:0.5rem">Generate</button></div>';
      html += '<div class="table-wrap"><table class="v-table"><thead><tr><th>Name</th><th>Prefix</th><th>Expires</th><th>Created</th><th class="text-right">Actions</th></tr></thead><tbody>';
      keys.forEach(function (k) {
        html += '<tr><td style="font-weight:500;color:var(--gray-700)">' + esc(k.name) + "</td>" +
          '<td class="mono text-xs text-muted">' + esc(k.prefix) + "…</td>" +
          '<td class="text-muted">' + (k.expires_at ? fmtDate(k.expires_at) : "never") + "</td>" +
          '<td class="text-muted">' + fmtDate(k.created_at) + "</td>" +
          '<td class="text-right"><button type="button" class="btn btn-ghost btn-sm" data-del="' + esc(k.id) + '" style="color:var(--red-700)">Revoke</button></td></tr>';
      });
      html += "</tbody></table></div>";
      if (keys.length === 0) html += '<p class="text-sm text-muted" style="text-align:center;padding:2rem 0">No API keys yet. Generate one for system integrations.</p>';
      html += "</div>";
      $("tab-keys").innerHTML = html;
      $("key-toggle").addEventListener("click", function () {
        $("key-form").hidden = !$("key-form").hidden;
        $("secret-box").hidden = true;
      });
      $("key-create").addEventListener("click", function () {
        var msg = $("key-msg");
        var name = $("key-name").value.trim();
        if (!name) { msg.innerHTML = '<p class="alert alert-error">A name is required.</p>'; return; }
        $("key-create").disabled = true;
        Verifo.api("/api-keys", {
          method: "POST",
          body: { name: name, ttl_days: $("key-ttl").value ? Number($("key-ttl").value) : undefined },
        }).then(function (r) {
          if (r.ok && r.body) {
            $("secret-box").hidden = false;
            $("secret-value").textContent = r.body.secret;
            $("key-form").hidden = true;
            $("key-name").value = "";
            $("key-ttl").value = "";
            loadKeys();
          } else {
            msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Could not create key.") + "</p>";
          }
        }).finally(function () { $("key-create").disabled = false; });
      });
      $("tab-keys").querySelectorAll("button[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          Verifo.api("/api-keys/" + b.getAttribute("data-del"), { method: "DELETE" }).then(function () { loadKeys(); });
        });
      });
    });
  }

  /* ---------- Audit ---------- */

  function loadAudit() {
    Verifo.api("/admin/audit").then(function (r) {
      var entries = r.ok && r.body ? r.body.entries || [] : [];
      var html = '<div class="card"><div class="card-header"><div><h2>Audit trail</h2><p>Append-only record of every meaningful action in this organization.</p></div></div>';
      if (entries.length === 0) {
        html += '<div class="empty"><h3>No audit entries yet</h3><p>Actions such as config changes, decisions, and uploads will appear here.</p></div>';
      } else {
        html += '<ul style="list-style:none;margin:0;padding:0">';
        entries.forEach(function (e) {
          html += '<li class="list-row" style="justify-content:space-between;align-items:flex-start">' +
            '<div style="min-width:0"><p style="font-weight:600;color:var(--gray-700);font-size:0.875rem">' + esc(e.action) + "</p>" +
            '<p class="text-xs text-muted" style="margin-top:0.125rem">' + esc(e.summary) + "</p></div>" +
            '<div class="text-right"><span class="badge badge-neutral">' + esc(e.actor_email || e.actor_id || "system") + "</span>" +
            '<p class="text-xs text-muted" style="margin-top:0.375rem">' + fmtDT(e.created_at) + "</p></div></li>";
        });
        html += "</ul>";
      }
      html += "</div>";
      $("tab-audit").innerHTML = html;
    });
  }
})();