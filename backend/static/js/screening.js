/* Screening page: jobs list, item detail, retry, create (admin). */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Verifo.esc(s); }
  function fmt(d) { return d ? new Date(d).toLocaleString() : ""; }

  var role = Verifo.role();
  var isAdmin = role === "ADMIN";
  var jobs = [];
  var selectedJob = null;
  var busy = false;

  Verifo.bootstrap().then(function () {
    if (isAdmin) $("create-slot").appendChild(createForm());
    loadJobs();
    Verifo.api("/references").then(function (r) {
      if (r.ok && r.body && r.body.references) populateRefs(r.body.references);
    });
  }).catch(function () {});

  var refSelect = null;
  function populateRefs(refs) {
    if (!refSelect) { var el = document.getElementById("job-reference"); if (el) refSelect = el; else return; }
    refs.forEach(function (ref) {
      var o = document.createElement("option");
      o.value = ref.id;
      o.textContent = ref.title + " (" + ref.ref_code + ")";
      refSelect.appendChild(o);
    });
  }

  function loadJobs() {
    return Verifo.api("/screening/jobs").then(function (r) {
      if (r.ok && r.body) {
        jobs = r.body.jobs || [];
        renderJobs();
      }
    });
  }

  function renderJobs() {
    $("jobs-count").textContent = jobs.length + " job(s)";
    var ul = $("jobs-list");
    ul.innerHTML = "";
    var empty = $("jobs-empty");
    if (jobs.length === 0) {
      empty.textContent = "No screening jobs yet. Create a job to screen a batch of documents.";
      return;
    }
    empty.textContent = "";
    jobs.forEach(function (job) {
      var total = job.total_count || 0;
      var done = job.done_count || job.processed_count || 0;
      var pct = total ? Math.round((done / total) * 100) : 0;
      var li = document.createElement("li");
      li.style.cssText = "border-top:1px solid var(--gray-100)";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "list-row" + (selectedJob && selectedJob.id === job.id ? " on" : "");
      b.style.cssText = b.style.cssText + ";flex-direction:column;align-items:stretch;padding:0.875rem 1.25rem";
      b.innerHTML =
        '<span style="display:flex;justify-content:space-between;gap:0.625rem;align-items:center;width:100%">' +
        '<span style="min-width:0"><span class="row-title" style="display:block">' + esc(job.title || "Job #" + job.id.slice(0, 8)) + "</span>" +
        '<span class="row-sub" style="display:block;margin-top:0.25rem">' + done + "/" + total + " processed · " + fmt(job.created_at) + "</span></span>" +
        Verifo.statusBadge(job.status) + "</span>" +
        '<div class="progress"><div style="width:' + pct + '%"></div></div>';
      b.addEventListener("click", function () { openJob(job); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function openJob(job) {
    selectedJob = job;
    $("items-heading").textContent = "Items — " + (job.title || job.id.slice(0, 8));
    $("retry-btn").classList.toggle("hidden", !isAdmin);
    var ul = $("items-list");
    var empty = $("items-empty");
    ul.innerHTML = "";
    empty.innerHTML = '<div class="spinner"><span class="dot"></span>Loading items…</div>';
    Verifo.api("/screening/jobs/" + job.id + "/items").then(function (r) {
      empty.innerHTML = "";
      var items = r.ok && r.body ? r.body.items || [] : [];
      selectedJob = Object.assign({}, job, { items: items });
      if (items.length === 0) {
        empty.innerHTML = '<div class="empty"><h3>No items yet</h3><p>Items appear here once documents are extracted from the upload.</p></div>';
        return;
      }
      items.forEach(function (it) {
        var li = document.createElement("li");
        li.style.cssText = "border-top:1px solid var(--gray-100)";
        li.className = "list-row";
        li.innerHTML =
          '<div style="min-width:0"><p class="row-title">' + esc(it.filename) + "</p>" +
          '<p class="row-sub">score: ' + (it.score != null ? Math.round(it.score) : "—") +
          (it.error ? " · " + esc(it.error) : "") + "</p></div>" +
          '<span style="margin-left:auto">' + Verifo.statusBadge(it.status) + "</span>";
        ul.appendChild(li);
      });
    });
  }

  var retryBtn = $("retry-btn") || null;
  if (retryBtn) {
    retryBtn.addEventListener("click", function () {
      if (busy || !selectedJob) return;
      busy = true;
      retryBtn.disabled = true;
      Verifo.api("/screening/jobs/" + selectedJob.id + "/retry", { method: "POST" })
        .then(function () { return openJob(selectedJob); })
        .finally(function () { busy = false; retryBtn.disabled = false; });
    });
  }

  function createForm() {
    var wrap = document.createElement("div");
    wrap.className = "create-card";
    wrap.innerHTML =
      "<h3>New screening job</h3>" +
      '<input class="input" id="job-title" placeholder="Job title (optional)" style="margin-bottom:0.625rem">' +
      '<select class="input" id="job-reference" style="margin-bottom:0.625rem"><option value="">No reference (library lookup only)</option></select>' +
      '<div class="tabs" style="margin-bottom:0.625rem"><button type="button" class="tab-pill on" data-mode="zip">ZIP archive</button>' +
      '<button type="button" class="tab-pill off" data-mode="multi">Multiple files</button></div>' +
      '<input type="file" id="job-file" class="input" accept=".zip" style="margin-bottom:0.625rem">' +
      '<div id="job-msg"></div>' +
      '<button type="button" class="btn btn-primary" id="job-create" style="width:100%;margin-top:0.375rem">Create &amp; queue</button>';
    wrap.querySelectorAll(".tab-pill").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-mode");
        wrap.querySelectorAll(".tab-pill").forEach(function (x) { x.className = "tab-pill off"; });
        b.className = "tab-pill on";
        var fi = wrap.querySelector("#job-file");
        fi.accept = mode === "zip" ? ".zip" : ".pdf,.png,.jpg,.jpeg";
        fi.removeAttribute("multiple");
        if (mode === "multi") fi.setAttribute("multiple", "");
      });
    });
    var mode = "zip";
    var createBtn = wrap.querySelector("#job-create");
    createBtn.addEventListener("click", function () {
      var file = wrap.querySelector("#job-file");
      var msg = wrap.querySelector("#job-msg");
      var f = file.files[0];
      if (mode === "zip" && !f) { msg.innerHTML = '<p class="alert alert-error">Choose a ZIP archive.</p>'; return; }
      if (mode === "multi" && file.files.length === 0) { msg.innerHTML = '<p class="alert alert-error">Add at least one file.</p>'; return; }
      busy = true;
      createBtn.disabled = true;
      var fd = new FormData();
      if (mode === "zip") { fd.append("file", f); }
      else { Array.prototype.forEach.call(file.files, function (x) { fd.append("files", x); }); }
      var title = wrap.querySelector("#job-title").value.trim();
      if (title) fd.append("title", title);
      var refId = wrap.querySelector("#job-reference").value;
      if (refId) fd.append("reference_id", refId);
      Verifo.upload("/screening/jobs", fd).then(function (r) {
        if (r.ok) {
          msg.innerHTML = '<p class="alert alert-ok">Job created and queued for processing.</p>';
          wrap.querySelector("#job-title").value = "";
          file.value = "";
          loadJobs();
        } else {
          msg.innerHTML = '<p class="alert alert-error">' + esc((r.body.error && r.body.error.message) || "Could not create job.") + "</p>";
        }
      }).catch(function () {
        msg.innerHTML = '<p class="alert alert-error">Network error.</p>';
      }).finally(function () { busy = false; createBtn.disabled = false; });
    });
    return wrap;
  }
})();