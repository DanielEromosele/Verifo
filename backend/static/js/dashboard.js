/* Dashboard page: stats, Chart.js volume/outcome charts, recent verifications, team. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var volumeChart = null;
  var outcomeChart = null;

  var BRAND = "#7c3aed";
  var GRAY = "#e5e7eb";
  var STATUS_COLORS = {
    VERIFIED: "#059669", REVIEW: "#d97706", REJECTED: "#dc2626",
    PROCESSING: "#0369a1", SUBMITTED: "#7c3aed",
  };

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
    var canvas = $("volume-chart");
    var empty = $("volume-empty");
    if (volumeChart) { volumeChart.destroy(); volumeChart = null; }

    // per_day_status: { "2026-09-20": { SUBMITTED: n, VERIFIED: n, _uploaded: n } }
    var perDayStatus = a.per_day_status || {};
    var days = Object.keys(perDayStatus).sort();
    if (days.length === 0) {
      var perDay = a.per_day || {};
      days = Object.keys(perDay).sort();
      if (days.length === 0) {
        empty.textContent = "No verifications yet — submit your first document.";
        return;
      }
    }
    empty.textContent = "";

    var uploaded = days.map(function (d) {
      var b = perDayStatus[d] || {};
      return b._uploaded != null ? Number(b._uploaded) : Number(a.per_day ? a.per_day[d] : b[d]) || 0;
    });
    var verified = days.map(function (d) {
      var b = perDayStatus[d] || {};
      return Number(b.VERIFIED) || 0;
    });

    var labels = days.map(function (d) {
      var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? m[3] + "/" + m[2] : d;
    });

    volumeChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Uploaded",
            data: uploaded,
            borderColor: BRAND,
            backgroundColor: "rgba(124, 58, 237, 0.10)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: BRAND,
            pointBorderWidth: 2,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: "Verified",
            data: verified,
            borderColor: "#059669",
            backgroundColor: "rgba(5, 150, 105, 0.08)",
            fill: false,
            tension: 0.35,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#059669",
            pointBorderWidth: 2,
            pointRadius: 3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#4b5563", usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              title: function (items) { return labels[items[0].dataIndex]; },
              label: function (item) { return " " + item.dataset.label + ": " + item.parsed.x; },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#9ca3af", font: { size: 11 } },
            grid: { color: "#f3f4f6" },
            title: { display: true, text: "Documents", color: "#6b7280", font: { size: 11 } },
          },
          y: {
            ticks: { color: "#9ca3af", font: { size: 11 } },
            grid: { display: false },
            title: { display: true, text: "Day", color: "#6b7280", font: { size: 11 } },
          },
        },
      },
    });
  }

  function renderOutcomes(a) {
    var canvas = $("outcome-chart");
    var empty = $("outcome-empty");
    if (outcomeChart) { outcomeChart.destroy(); outcomeChart = null; }

    var by = a.by_status || {};
    var keys = Object.keys(by);
    if (keys.length === 0) {
      empty.style.display = "block";
      empty.textContent = "Nothing yet.";
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    empty.style.display = "none";
    empty.textContent = "";

    outcomeChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: keys,
        datasets: [{
          data: keys.map(function (k) { return by[k]; }),
          backgroundColor: keys.map(function (k) { return STATUS_COLORS[k] || "#9ca3af"; }),
          borderWidth: 2,
          borderColor: "#ffffff",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#4b5563", usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: function (item) { return " " + item.label + ": " + item.parsed + " (" + Math.round(item.parsed / item.dataset.data.reduce(function (a, b) { return a + b; }, 0) * 100) + "%)"; },
            },
          },
        },
      },
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