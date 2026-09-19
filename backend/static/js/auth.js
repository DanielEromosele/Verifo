/* Auth pages: sign in, request access, MFA, reset. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function show(id) { var el = $(id); if (el) el.classList.remove("hidden"); }
  function hide(id) { var el = $(id); if (el) el.classList.add("hidden"); }
  function text(id, v) { var el = $(id); if (el) el.textContent = v; }
  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }

  function fail(btn, box, msg) {
    text(box, msg); show(box);
    if (btn) btn.disabled = false;
  }

  function post(path, body) {
    return fetch(Verifo.API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; });
    });
  }

  /* ---- Sign in ---- */
  var loginForm = $("login-form");
  if (loginForm) {
    // Demo quick-fill: insert credentials into the form without submitting.
    (function () {
      var demoBtns = document.querySelectorAll("[data-demo-email]");
      for (var i = 0; i < demoBtns.length; i++) {
        demoBtns[i].addEventListener("click", function () {
          $("email").value = this.getAttribute("data-demo-email");
          $("password").value = this.getAttribute("data-demo-password");
          hide("error-box");
        });
      }
    })();
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hide("error-box");
      var btn = $("submit-btn");
      btn.disabled = true;
      post("/auth/login", { email: val("email"), password: val("password") })
        .then(function (res) {
          var d = res.body && res.body;
          if (res.ok && d && d.token) {
            Verifo.setToken(d.token);
            window.location.href = "/dashboard";
          } else {
            fail(btn, "error-box", (res.body && res.body.error && res.body.error.message) || "Sign in failed.");
          }
        })
        .catch(function () { fail(btn, "error-box", "Network error — could not reach the server."); });
    });
  }

  /* ---- Request access ---- */
  var registerForm = $("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var agree = $("agree");
      if (agree && !agree.checked) {
        fail($("submit-btn"), "error-box", "Please agree to the Acceptable Use Policy.");
        return;
      }
      hide("error-box");
      var btn = $("submit-btn");
      btn.disabled = true;
      post("/auth/register", {
        full_name: val("full_name"),
        email: val("email"),
        password: val("password"),
        organization_name: val("organization_name"),
        organization_slug: "",
        industry: val("industry"),
      })
        .then(function (res) {
          var d = res.body && res.body;
          if (res.ok && d && d.token) {
            Verifo.setToken(d.token);
            window.location.href = "/dashboard";
          } else {
            var e2 = res.body && res.body.error;
            var msg = (e2 && e2.message) || "Could not create your workspace.";
            fail(btn, "error-box", msg);
          }
        })
        .catch(function () { fail(btn, "error-box", "Network error — could not reach the server."); });
    });
  }

  /* ---- MFA ---- */
  var mfaForm = $("mfa-form");
  if (mfaForm) {
    var otps = [0, 1, 2, 3, 4, 5].map(function (i) { return $("otp" + i); });
    otps.forEach(function (inp, i) {
      inp.addEventListener("input", function () {
        inp.value = inp.value.replace(/\D/g, "");
        if (inp.value && i < otps.length - 1) otps[i + 1].focus();
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !inp.value && i > 0) otps[i - 1].focus();
      });
    });
    mfaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hide("error-box");
      var code = otps.map(function (i) { return i.value; }).join("");
      if (code.length !== 6) {
        fail($("submit-btn"), "error-box", "Enter the full 6-digit code.");
        return;
      }
      var btn = $("submit-btn");
      btn.disabled = true;
      setTimeout(function () {
        sessionStorage.removeItem("verifo_mfa_pending");
        window.location.href = "/dashboard";
      }, 600);
    });
    var resend = $("resend");
    if (resend) resend.addEventListener("click", function (e) {
      e.preventDefault();
      var btn = $("submit-btn");
      btn.disabled = true;
      text("submit-btn", "Code sent");
      setTimeout(function () { text("submit-btn", "Verify code"); btn.disabled = false; }, 3000);
    });
  }

  /* ---- Reset ---- */
  var resetForm = $("reset-form");
  if (resetForm) {
    resetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hide("error-box");
      var btn = $("submit-btn");
      btn.disabled = true;
      text("sent-email", val("email"));
      setTimeout(function () {
        hide("reset-form");
        show("ok-box");
      }, 400);
    });
  }
})();