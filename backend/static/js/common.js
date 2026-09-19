/* Shared frontend helpers for the server-rendered app. */
(function () {
  "use strict";

  window.Verifo = window.Verifo || {};

  var TOKEN_KEY = "verifo_token";

  Verifo.API = "/api/v1";
  Verifo.TOKEN_KEY = TOKEN_KEY;

  Verifo.token = function () {
    return localStorage.getItem(TOKEN_KEY) || "";
  };

  Verifo.setToken = function (t) {
    localStorage.setItem(TOKEN_KEY, t);
  };

  Verifo.clearToken = function () {
    localStorage.removeItem(TOKEN_KEY);
  };

  Verifo.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  Verifo.api = function (path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var t = Verifo.token();
    if (t) opts.headers["Authorization"] = "Bearer " + t;
    if (opts.body && typeof opts.body !== "string") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(Verifo.API + path, opts).then(function (r) {
      return r.json().then(function (b) {
        return { ok: r.ok, status: r.status, body: b };
      });
    });
  };

  Verifo.upload = function (path, formData) {
    var t = Verifo.token();
    return fetch(Verifo.API + path, {
      method: "POST",
      headers: t ? { Authorization: "Bearer " + t } : {},
      body: formData,
    }).then(function (r) {
      return r.json().then(function (b) {
        return { ok: r.ok, status: r.status, body: b };
      });
    });
  };

  /* Decode the JWT's payload (role + org live in claims). */
  Verifo.claims = function () {
    var t = Verifo.token();
    if (!t) return {};
    try {
      var part = t.split(".")[1];
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) {
      return {};
    }
  };

  Verifo.role = function () {
    var c = Verifo.claims();
    return (c.role || "").toUpperCase();
  };

  Verifo.signOut = function () {
    Verifo.clearToken();
    document.cookie =
      "access_token_cookie=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/signin";
  };

  /* Boot guard for workspace pages: 401 or missing token -> /signin. */
  Verifo.bootstrap = function () {
    var meta = document.querySelector('meta[name="user"]');
    if (meta) return Promise.resolve(JSON.parse(decodeURIComponent(meta.content)));
    if (!Verifo.token()) {
      window.location.href = "/signin";
      return Promise.reject(new Error("no session"));
    }
    return Verifo.api("/auth/me").then(function (res) {
      if (!res.ok) {
        Verifo.clearToken();
        window.location.href = "/signin";
        throw new Error("unauthorized");
      }
      return res.body;
    });
  };

  Verifo.statusBadge = function (s) {
    s = String(s || "").toUpperCase();
    var map = {
      VERIFIED: ["ok", "verified"],
      ACTIVE: ["ok", "active"],
      READY: ["info", "ready"],
      PROCESSING: ["info", "processing"],
      QUEUED: ["neutral", "queued"],
      IN_PROGRESS: ["info", "in progress"],
      REVIEW: ["warn", "review"],
      WARNING: ["warn", "warning"],
      PENDING: ["warn", "pending"],
      PENDING_REVIEW: ["warn", "pending review"],
      REJECTED: ["bad", "rejected"],
      FLAGGED: ["bad", "flagged"],
      FAILED: ["bad", "failed"],
      SUSPENDED: ["bad", "suspended"],
      DISABLED: ["neutral", "disabled"],
    };
    var m = map[s] || ["neutral", s.toLowerCase()];
    return '<span class="badge badge-' + m[0] + '">' + Verifo.esc(m[1]) + "</span>";
  };

  Verifo.membershipSwitch = function () {
    var post = document.querySelector('form[name="switch-org"]');
    if (!post) return;
    post.addEventListener("submit", function (e) {
      e.preventDefault();
      var token = post.querySelector('input[name="token"]');
      if (!token) return;
      Verifo.setToken(token.value);
      window.location.href = "/dashboard";
    });
  };
})();