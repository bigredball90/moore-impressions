/* Moore Impressions demo: "Edit text"

   Anyone viewing the demo can click Edit text (bottom right), click any heading, paragraph, list item, label or
   button and type. Each change is saved in that browser as they type, so it stays while they move between pages
   and come back later. "Send changes" gathers every change (page, what it said, what it says now) and their notes
   into one message they can email, copy or share. Nothing here changes the site files or the real website: the
   changes get folded into src/pages/ from that message, then the site is rebuilt.

   A change is keyed by its page (or "site" for the header and footer) plus a hash of the original wording, so it
   only ever lands on the text it was made on. Once the source has the new wording, the old key matches nothing
   and is dropped the next time that page loads. */

(function () {
  "use strict";

  var STORE = "mi-demo-edits-v1";
  var NOTES = "mi-demo-notes-v1";
  var DEMO_URL = "https://bigredball90.github.io/moore-impressions/";

  // What can be edited, and what never is.
  var SEL = "h1,h2,h3,h4,p,li,dt,dd,label,figcaption,.eyebrow,.gallery-cap,.compare__tag,.btn,.text-link,.filter";
  var SKIP = ".site-nav,.crumbs,.form-status,.mi-edit-ui,.lightbox,select,textarea,[aria-hidden='true']";
  var BLOCK = "h1,h2,h3,h4,p,div,ul,ol,li,dl,dt,dd,section,article,form,label,figure,figcaption,table";
  var NOT_TEXT = "svg,img,button,input,select,textarea";

  var ALLOW = { A: ["href", "target", "rel"], EM: ["class"], STRONG: ["class"], B: [], I: ["class"], BR: [], SPAN: ["class"] };
  var DROP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, NOSCRIPT: 1 };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }
  function hash(t) {
    var h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function has(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }

  // Edited text keeps its words, links and bold/italic; anything else (pasted markup, scripts) is stripped.
  function clean(html) {
    var root = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html").body.firstChild;
    if (!root) return "";
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) return;
        var tag = c.nodeType === 1 ? c.nodeName.toUpperCase() : "";
        if (!tag || DROP[tag]) {
          node.removeChild(c);
          return;
        }
        walk(c);
        var keep = ALLOW[tag];
        if (!keep) {
          while (c.firstChild) node.insertBefore(c.firstChild, c);
          node.removeChild(c);
          return;
        }
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          if (keep.indexOf(a.name) < 0) c.removeAttribute(a.name);
        });
        if (tag === "A" && /^\s*(javascript|data|vbscript):/i.test(c.getAttribute("href") || "")) c.removeAttribute("href");
      });
    })(root);
    return root.innerHTML.replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").trim();
  }
  function textOf(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return norm(d.textContent);
  }

  /* ---------------- Which page is this ---------------- */

  var logo = $(".site-logo");
  var rootPath = logo ? new URL(logo.getAttribute("href"), location.href).pathname : "/";
  var path = location.pathname;
  var slug = path.indexOf(rootPath) === 0 ? path.slice(rootPath.length) : path.replace(/^\//, "");
  slug = slug.replace(/index\.html$/, "").replace(/\/$/, "");
  var pageName = slug ? norm(document.title.split("|")[0]) : "Home";
  var SITE_NAME = "Every page (header and footer)";

  /* ---------------- Find the editable text ---------------- */

  var EDS = [];
  var byKey = {};
  var seen = {};

  function register(el) {
    var text = norm(el.textContent);
    if (!text) return;
    var scope = el.closest(".site-header,.site-footer") ? "site" : slug || "home";
    var base = scope + "|" + hash(text);
    var n = (seen[base] = (seen[base] || 0) + 1);
    var key = base + (n > 1 ? "#" + n : "");
    el.setAttribute("data-ek", key);
    var e = { el: el, key: key, scope: scope, orig: el.innerHTML, text: text };
    EDS.push(e);
    byKey[key] = e;
  }

  document.querySelectorAll(SEL).forEach(function (el) {
    if (el.closest(SKIP) || el.closest("[data-ek]")) return;
    if (!norm(el.textContent) || el.querySelector(BLOCK)) return; // a container: its own text blocks get their turn
    if (el.tagName !== "BUTTON" && !el.querySelector(NOT_TEXT)) {
      register(el);
      return;
    }
    // Words next to an icon or photo, or inside a button: wrap just the words so only they are editable.
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && norm(n.nodeValue)) {
        var m = n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
        var span = document.createElement("span");
        span.className = "ek-label";
        span.textContent = m[2];
        if (m[1]) el.insertBefore(document.createTextNode(m[1]), n);
        el.insertBefore(span, n);
        if (m[3]) el.insertBefore(document.createTextNode(m[3]), n);
        el.removeChild(n);
        register(span);
      } else if (n.nodeType === 1 && !n.matches(NOT_TEXT) && !n.querySelector(NOT_TEXT) && !n.closest(SKIP) && !n.matches(SEL)) {
        register(n);
      }
    });
  });

  // Text that appears more than once on a page (four "Order Now" buttons) gets the heading it sits under in the
  // message, so it's clear which one changed.
  function nearHeading(el) {
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      var hs = a.querySelectorAll("h1,h2,h3");
      for (var i = 0; i < hs.length; i++) {
        if (hs[i] === el || hs[i].contains(el)) continue;
        var k = hs[i].getAttribute("data-ek");
        return k && byKey[k] ? byKey[k].text : norm(hs[i].textContent);
      }
    }
    return "";
  }
  EDS.forEach(function (e) {
    if (seen[e.key.split("#")[0]] > 1) e.near = nearHeading(e.el);
  });

  /* ---------------- Saved changes ---------------- */

  var canStore = true;
  var store = { version: 1, edits: {} };
  try {
    var raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (raw && raw.edits && typeof raw.edits === "object") store = raw;
  } catch (err) {
    canStore = false;
  }
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify(store));
      canStore = true;
    } catch (err) {
      canStore = false;
    }
  }

  // Drop changes for this page (and the shared header/footer) whose original wording is no longer on it.
  var pruned = false;
  Object.keys(store.edits).forEach(function (k) {
    var scope = k.split("|")[0];
    if ((scope === (slug || "home") || scope === "site") && !byKey[k]) {
      delete store.edits[k];
      pruned = true;
    }
  });
  if (pruned) persist();

  function paint(e) {
    var saved = store.edits[e.key];
    if (saved && e.el !== document.activeElement) e.el.innerHTML = clean(saved.now);
    e.el.toggleAttribute("data-ek-changed", !!saved);
  }
  EDS.forEach(paint);

  function count() {
    return Object.keys(store.edits).length;
  }

  function saveEntry(e) {
    var now = clean(e.el.innerHTML);
    var nowText = textOf(now);
    var before = store.edits[e.key];
    if ((!nowText || nowText === e.text) === !before && (!before || before.now === now)) return; // nothing new
    if (!nowText || nowText === e.text) {
      delete store.edits[e.key];
    } else {
      store.edits[e.key] = {
        page: e.scope === "site" ? SITE_NAME : pageName,
        was: e.text,
        near: e.near || "",
        now: now,
        t: Date.now()
      };
    }
    e.el.toggleAttribute("data-ek-changed", has(store.edits, e.key));
    persist();
    refresh();
    setStatus(canStore ? "Saved on this device." : "This browser can’t save changes. Use Send changes before you leave this page.");
  }

  /* ---------------- The controls ---------------- */

  var ui = document.createElement("div");
  ui.className = "mi-edit-ui";
  ui.innerHTML =
    '<button class="mi-edit-fab" type="button" aria-label="Edit text on this demo site">' +
    '<svg aria-hidden="true"><use href="#i-pen"/></svg><span>Edit text</span><span class="mi-edit-count" hidden></span></button>' +
    '<div class="mi-edit-bar" role="region" aria-label="Edit text" hidden>' +
    '<p class="mi-edit-status" role="status" aria-live="polite"></p>' +
    '<div class="mi-edit-actions">' +
    '<button class="mi-btn mi-btn--send" type="button">Send changes <span class="mi-edit-count" hidden></span></button>' +
    '<button class="mi-btn mi-btn--ghost mi-undo" type="button">Undo all</button>' +
    '<button class="mi-btn mi-btn--done" type="button">Done</button>' +
    "</div></div>" +
    '<dialog class="mi-send" aria-labelledby="mi-send-title">' +
    '<form method="dialog" class="mi-send__inner">' +
    '<h2 id="mi-send-title">Send your changes</h2>' +
    '<p class="mi-send__intro">Send this to the person building the site. Nothing changes on the real website until they add it.</p>' +
    '<pre class="mi-send__list" tabindex="0"></pre>' +
    '<label class="mi-send__label" for="mi-notes">Anything else? Photos to swap, colors, layout, things to add or remove</label>' +
    '<textarea id="mi-notes" rows="3" placeholder="Optional"></textarea>' +
    '<div class="mi-send__actions">' +
    '<button class="mi-btn mi-btn--send mi-email" type="button">Email</button>' +
    '<button class="mi-btn mi-btn--ghost mi-share" type="button" hidden>Text or share</button>' +
    '<button class="mi-btn mi-btn--ghost mi-copy" type="button">Copy</button>' +
    '<button class="mi-btn mi-btn--ghost" value="close">Close</button>' +
    "</div>" +
    '<p class="mi-send__status" role="status" aria-live="polite"></p>' +
    "</form></dialog>";
  document.body.appendChild(ui);

  var fab = $(".mi-edit-fab", ui);
  var bar = $(".mi-edit-bar", ui);
  var statusEl = $(".mi-edit-status", ui);
  var undoBtn = $(".mi-undo", ui);
  var dialog = $(".mi-send", ui);
  var listEl = $(".mi-send__list", ui);
  var notesEl = $("#mi-notes", ui);
  var sendStatus = $(".mi-send__status", ui);
  var shareBtn = $(".mi-share", ui);

  var HINT = "Click any text to change it. It saves on this device as you type.";
  var statusTimer = null;
  function setStatus(t) {
    statusEl.textContent = t;
    clearTimeout(statusTimer);
    if (t !== HINT) {
      statusTimer = setTimeout(function () {
        if (editing) statusEl.textContent = HINT;
      }, 2400);
    }
  }

  function refresh() {
    var n = count();
    ui.querySelectorAll(".mi-edit-count").forEach(function (c) {
      c.textContent = n;
      c.hidden = !n;
    });
    undoBtn.disabled = !n;
    fab.setAttribute("aria-label", n ? "Edit text on this demo site (" + n + " changed)" : "Edit text on this demo site");
  }
  refresh();

  var PLAIN = (function () {
    var d = document.createElement("div");
    try {
      d.contentEditable = "plaintext-only";
    } catch (err) {
      return false;
    }
    return d.contentEditable === "plaintext-only";
  })();

  var editing = false;
  var timers = {}; // typing pauses still waiting to be saved, by key
  function startEdit() {
    editing = true;
    document.body.classList.add("mi-editing");
    EDS.forEach(function (e) {
      e.el.contentEditable = PLAIN ? "plaintext-only" : "true";
      e.el.spellcheck = true;
    });
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-in");
    });
    bar.hidden = false;
    fab.hidden = true;
    setStatus(HINT);
    try {
      sessionStorage.setItem("mi-demo-editing", "1");
    } catch (err) {}
  }
  function stopEdit() {
    flush();
    editing = false;
    document.body.classList.remove("mi-editing");
    if (document.activeElement && document.activeElement.hasAttribute("data-ek")) document.activeElement.blur();
    EDS.forEach(function (e) {
      e.el.removeAttribute("contenteditable");
      e.el.removeAttribute("spellcheck");
    });
    bar.hidden = true;
    fab.hidden = false;
    try {
      sessionStorage.removeItem("mi-demo-editing");
    } catch (err) {}
  }

  fab.addEventListener("click", startEdit);
  $(".mi-btn--done", bar).addEventListener("click", stopEdit);
  undoBtn.addEventListener("click", function () {
    flush();
    var n = count();
    if (!n) return;
    if (!window.confirm("Undo all " + n + " text change" + (n === 1 ? "" : "s") + " on every page? This can’t be undone.")) return;
    store.edits = {};
    persist();
    EDS.forEach(function (e) {
      e.el.innerHTML = e.orig;
      e.el.removeAttribute("data-ek-changed");
    });
    refresh();
    setStatus("All changes undone.");
  });

  // Keep editing on as people move between pages, until they click Done.
  try {
    if (sessionStorage.getItem("mi-demo-editing") === "1") startEdit();
  } catch (err) {}

  /* ---------------- Typing ---------------- */

  document.addEventListener("input", function (ev) {
    if (!editing || !ev.target.closest) return;
    var el = ev.target.closest("[data-ek]");
    if (!el) return;
    var e = byKey[el.getAttribute("data-ek")];
    clearTimeout(timers[e.key]);
    timers[e.key] = setTimeout(function () {
      delete timers[e.key];
      saveEntry(e);
    }, 350);
  });
  // Save anything still waiting on the typing pause before the page goes away (e.g. a menu link clicked right after typing).
  function flush() {
    Object.keys(timers).forEach(function (k) {
      clearTimeout(timers[k]);
      delete timers[k];
      if (byKey[k]) saveEntry(byKey[k]);
    });
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  document.addEventListener("focusout", function (ev) {
    if (!editing || !ev.target.hasAttribute || !ev.target.hasAttribute("data-ek")) return;
    var e = byKey[ev.target.getAttribute("data-ek")];
    clearTimeout(timers[e.key]);
    delete timers[e.key];
    saveEntry(e);
    if (!norm(e.el.textContent)) e.el.innerHTML = e.orig; // cleared text goes back to the original
  });

  // While editing: links, buttons and the photo slider don't react, Enter finishes, and pasted text comes in plain.
  document.addEventListener(
    "click",
    function (ev) {
      if (editing && ev.target.closest && ev.target.closest("[data-ek]")) {
        ev.preventDefault(); // links don't open
        ev.stopPropagation(); // and buttons (gallery photos, filters) don't react
      }
    },
    true
  );
  document.addEventListener(
    "pointerdown",
    function (ev) {
      if (editing && ev.target.closest && ev.target.closest("[data-ek]")) ev.stopPropagation();
    },
    true
  );
  document.addEventListener(
    "keydown",
    function (ev) {
      if (!editing || !ev.target.closest || !ev.target.closest("[data-ek]")) return;
      if (ev.key === "Enter" || ev.key === "Escape") {
        ev.preventDefault();
        ev.target.blur();
      }
      ev.stopPropagation(); // e.g. the gallery's arrow keys
    },
    true
  );
  document.addEventListener("paste", function (ev) {
    if (!editing || PLAIN || !ev.target.closest || !ev.target.closest("[data-ek]")) return;
    ev.preventDefault();
    var text = (ev.clipboardData || window.clipboardData).getData("text/plain").replace(/\s+/g, " ");
    document.execCommand("insertText", false, text);
  });

  /* ---------------- Send changes ---------------- */

  try {
    notesEl.value = localStorage.getItem(NOTES) || "";
  } catch (err) {}
  notesEl.addEventListener("input", function () {
    try {
      localStorage.setItem(NOTES, notesEl.value);
    } catch (err) {}
    listEl.textContent = message();
  });

  function message() {
    var edits = store.edits;
    var keys = Object.keys(edits);
    var groups = {};
    var order = [];
    keys
      .sort(function (a, b) {
        return (edits[a].t || 0) - (edits[b].t || 0);
      })
      .forEach(function (k) {
        var g = edits[k].page || "Other";
        if (!groups[g]) {
          groups[g] = [];
          order.push(g);
        }
        groups[g].push(edits[k]);
      });
    var lines = ["Moore Impressions demo site: changes", ""];
    if (!keys.length) lines.push("No text changes yet.");
    else lines.push(keys.length + " text change" + (keys.length === 1 ? "" : "s") + ":");
    order.forEach(function (g) {
      lines.push("", g.toUpperCase());
      groups[g].forEach(function (c) {
        lines.push("- Was: " + c.was + (c.near ? "  (under “" + c.near + "”)" : ""), "  Now: " + textOf(c.now));
      });
    });
    var notes = notesEl.value.trim();
    if (notes) lines.push("", "OTHER NOTES", notes);
    lines.push("", "(From the Edit text button on " + DEMO_URL + ")");
    return lines.join("\n");
  }

  if (navigator.share) shareBtn.hidden = false;

  $(".mi-btn--send", bar).addEventListener("click", function () {
    flush();
    listEl.textContent = message();
    sendStatus.textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });

  $(".mi-email", dialog).addEventListener("click", function () {
    window.location.href =
      "mailto:?subject=" + encodeURIComponent("Moore Impressions website changes") + "&body=" + encodeURIComponent(message());
    sendStatus.textContent = "Your email app should open with everything filled in. Add who it’s going to, then send. Nothing opened? Use Copy and paste it into an email or text.";
  });

  $(".mi-copy", dialog).addEventListener("click", function () {
    var text = message();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      dialog.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {}
      dialog.removeChild(ta);
      sendStatus.textContent = ok ? "Copied. Paste it into an email or text." : "Couldn’t copy. Select the text above and copy it.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        sendStatus.textContent = "Copied. Paste it into an email or text.";
      }, fallback);
    } else fallback();
  });

  shareBtn.addEventListener("click", function () {
    navigator.share({ title: "Moore Impressions website changes", text: message() }).catch(function () {});
  });
})();
