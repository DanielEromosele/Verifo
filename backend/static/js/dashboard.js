/* Dashboard page: stats, volume chart, recent verifications, team. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  Verifo.bootstrap().then(function (me) {
    var role = Verifo.role();
    var isStaff = role === "ADMIN" || role === "OPERATOR";
    var isAdmin = role === "ADMIN";
    var user = (me && me.user) || {};

    var first = (user.full_name || "there").split(" ")[0];
    $("dash-org").textContent = (user.organization && user.organization.name) || "Workspace";
    $("dash-welcome").textContent = "Welcome back, " + first;

    $("dash-sub").textContent = isAdmin
      ? "You administer this organization, its references, and verification configuration."
      : isStaff
        ? "Single verification and bulk screening await below."
        : "Your workspace is ready. Upload a document to verify anytime.";

    if (isAdmin) {
      document.querySelectorAll(".staff-only").forEach(function (el) {
        el.classList.remove("hidden");
      });
    }
    if (!isStaff) {
      $("stat-grid").classList.add("hidden");
    }

    var tasks = [];
    if (isStaff) tasks.push(Verifo.api("/admin/analytics"));
    if (isAdmin) tasks.push(Verifo.api("/users"));
    tasks.push(Verifo.api("/verifications"));

    Promise.allSettled(tasks).then(function (results) {
      var analytics = null, users = [];
      var resultsByPath = {};

      results.forEach(function (r) {
        if (r.status === "fulfilled" && r.value.ok && r.value.body && r.value.body) {
          var d = r.value.body;
          if (d.analytics !== undefined) {
            analytics = d.analytics;
            resultsByPath.analytics = d;
          }
          if (d.users !== undefined) { users = d.users || []; resultsByPath.users = d; }
          if (d.verifications !== undefined) resultsByPath.verifications = d.verifications || [];
        }
      });

      var verifications = resultsByPath.verifications || [];

      if (analytics) {
        renderStats(analytics);
        renderVolume(analytics);
        renderOutcomes(analytics);
      }
      renderRecent(verifications);
      if (isAdmin) renderTeam(users);
    });
  }).catch(function () {});

  function renderStats(a) {
    var vals = [
      a.volume != null ? String(a.volume) : "—",
      a.avg_score != null ? Math.round(a.avg_score) + "/100" : "—",
      a.flagged_ratio != null ? Math.round(a.flagged_ratio * 100) + "%" : "—",
      a.jobs != null ? String(a.jobs) : "—",
    ];
    var cards = document.querySelectorAll("#stat-grid .stat-value");
    vals.forEach(function (v, i) {
      if (cards[i]) cards[i].textContent = v;
    });
  }

  function renderVolume(a) {
    var bars = $("volume-bars");
    var empty = $("volume-empty");
    var perDay = a.per_day || {};
    var days = Object.keys(perDay);
    if (days.length === 0) {
      empty.textContent = "No verifications yet — submit your first document.";
      return;
    }
    var max = Math.max(1, ...days.map(function (d) { return Number(perDay[d]) || 0; }));
    days.forEach(function (day) {
      var n = Number(perDay[day]) || 0;
      var bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = Math.max(5, Math.round((n / max) * 100)) + "%";
      bar.title = day + ": " + n;
      bars.appendChild(bar);
    });
  }

  function renderOutcomes(a) {
    var list = $("outcome-list");
    var by = a.by_status || {};
    var keys = Object.keys(by);
    if (keys.length === 0) {
      list.innerHTML = '<p class="text-sm text-muted">Nothing yet.</p>';
      return;
    }
    list.innerHTML = "";
    keys.forEach(function (status) {
      var row = document.createElement("div");
      row.className = "flex items-center justify-between";
      row.style.cssText = "margin-top:0.375rem";
      row.innerHTML =
        Verifo.statusBadge(status) +
        '<span style="font-weight:600;color:var(--gray-700)">' + by[status] + "</span>";
      list.appendChild(row);
    });
  }

  function renderRecent(vs) {
    var tbody = $("recent-rows");
    var empty = $("recent-empty");
    if (vs.length === 0) {
      empty.textContent = "No submissions yet. Upload your first document to see results here.";
      return;
    }
    vs.slice(0, 8).forEach(function (v) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="truncate" style="max-width:240px;font-weight:500;color:var(--gray-700)">' + Verifo.esc(v.filename) + "</td>" +
        "<td>" + Verifo.statusBadge(v.status) + "</td>" +
        '<td style="font-weight:600;color:var(--gray-700)">' + (v.score != null ? Math.round(v.score) : "—") + "</td>" +
        '<td style="color:var(--gray-500)">' + (v.decision ? Verifo.esc(v.decision) : "—") + "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderTeam(users) {
    var tbody = $("team-rows");
    users.forEach(function (m) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="font-weight:500;color:var(--gray-700)">' + Verifo.esc((m.user && m.user.full_name) || "—") + "</td>" +
        '<td style="color:var(--gray-500)">' + Verifo.esc((m.user && m.user.email) || "") + "</td>" +
        "<td>" + Verifo.statusBadge(m.role) + "</td>" +
        '<td style="color:var(--gray-500)">' + Verifo.esc(m.status) + "</td>";
      tbody.appendChild(tr);
    });
  }
})();