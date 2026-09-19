/* Browser-side local AI enrichment (pdf.js + Transformers.js).
 *
 * Gated by the server flag LOCAL_JS, exposed as <meta name="local-js">:
 *   0 (default) -> browser enrichment is OFF: no CDN, no model, and no
 *                  ai_evidence is sent (pure no-op; server pipeline only).
 *   1           -> extract a PDF's text layer in this tab, run a small
 *                  on-device NER model, and return canonical fields.
 * Fields are evidence only; never a verdict. Auth is enforced by the page/API
 * — this script only runs on the authenticated verify page.
 */
(function () {
  "use strict";

  window.Verifo = window.Verifo || {};

  var CDN = {
    pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfjsWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    transformers: "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js",
  };

  var MODEL_ID = "Xenova/distilbert-base-uncased-finetuned-conll03-english";
  var LABELS = { PER: "full_name", ORG: "institution", DATE: "issue_date", LOC: "other" };
  var MIN_TEXT = 40; // below this we assume a scan with no text layer -> skip
  var DEFAULT_TIMEOUT = 45000; // first run downloads the model (~60 MB)

  var loaded = {};

  function flagOn() {
    var meta = document.querySelector('meta[name="local-js"]');
    return !!(meta && meta.content === "1");
  }

  function loadScript(src, globalName) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve(globalName ? window[globalName] : true);
      };
      s.onerror = function () {
        delete loaded[src];
        reject(new Error("script load failed: " + src));
      };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function pdfText(arrayBuffer) {
    return loadScript(CDN.pdfjs, "pdfjsLib")
      .then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
        return lib.getDocument({ data: arrayBuffer }).promise;
      })
      .then(function (doc) {
        var pages = [];
        for (var i = 1; i <= doc.numPages; i++) pages.push(doc.getPage(i));
        return Promise.all(pages).then(function (refs) {
          return Promise.all(refs.map(function (page) {
            return page.getTextContent();
          }));
        }).then(function (contents) {
          return contents.map(function (c) {
            return (c.items || []).map(function (it) {
              return String(it.str || "");
            }).join(" ");
          }).join("\n");
        });
      });
  }

  function entitiesFor(text) {
    return loadScript(CDN.transformers, "transformers")
      .then(function (mod) {
        return mod.pipeline("token-classification", MODEL_ID);
      })
      .then(function (classifier) {
        return classifier(text, { aggregation_strategy: "simple" });
      });
  }

  /* Maps NER spans to a handful of canonical keys. Multiple PER spans are
     joined into one display name; first value wins for the rest. */
  function toFields(entities) {
    var map = {};
    var ordered = [];
    (entities || []).forEach(function (e) {
      var word = String(e.word || "").trim();
      if (!word) return;
      var key = LABELS[e.entity_group] || "other";
      if (!map[key]) {
        map[key] = { values: [], first: true };
        ordered.push(key);
      }
      map[key].values.push(word);
    });

    var out = [];
    ordered.forEach(function (key) {
      if (!map[key].values.length) return;
      var value = key === "full_name"
        ? map[key].values.join(" ")
        : map[key].values[0];
      out.push({
        key: key,
        value: value,
        confidence: key === "full_name" ? 0.6 : 0.7,
      });
    });
    return out;
  }

  function isPdf(file) {
    return /\.pdf$/i.test(file && file.name || "") ||
      (file && file.type === "application/pdf");
  }

  /* Public: Verifo.localAiEnrich(file[, timeoutMs]) -> Promise<fields|null> */
  Verifo.localAiEnrich = function (file, timeoutMs) {
    if (!flagOn()) return Promise.resolve(null);
    if (!file || !isPdf(file)) return Promise.resolve(null);
    var ms = typeof timeoutMs === "number" ? timeoutMs : DEFAULT_TIMEOUT;

    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(null); }
      }, ms);

      var done = function (v) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
      };

      file.arrayBuffer().then(function (buf) {
        return pdfText(buf);
      }).then(function (text) {
        if (!text || text.trim().length < MIN_TEXT) return null;
        return entitiesFor(text);
      }).then(function (entities) {
        var fields = entities ? toFields(entities) : [];
        done(fields.length ? fields : null);
      }).catch(function () {
        done(null);
      });
    });
  };
})();