/* Moore Impressions site scripts
   - compare slider (low-res file vs. zoomed in @ print resolution)
   - mobile menu
   - quote form: "Request a quote" links and ?item= / ?service= prefill
   - forms open a pre-filled email to sales@mooreimpressions.com
   - scrolling work strip, gallery filters + lightbox
   - fade-in on scroll */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Compare slider ---------------- */

  // How many "pixels" wide the zoomed-in version is. Lower = blockier.
  var LOW_RES_COLUMNS = 46;

  function initCompare(root) {
    var hi = root.querySelector(".compare__hi");
    var lo = root.querySelector(".compare__lo");
    var range = root.querySelector(".compare__range");
    var tagLo = root.querySelector(".compare__tag--lo");
    var tagHi = root.querySelector(".compare__tag--hi");
    var isStatic = root.classList.contains("compare--static");
    var canvas = document.createElement("canvas");
    var touched = false;
    var pos = parseFloat(root.getAttribute("data-start")) || 50;

    canvas.setAttribute("aria-hidden", "true");
    lo.appendChild(canvas);

    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      root.style.setProperty("--pos", pos + "%");
      if (range) {
        range.value = Math.round(pos);
        range.setAttribute("aria-valuetext", Math.round(pos) + "% zoomed in to print resolution");
      }
      // Hide a label once its side gets too narrow to hold it.
      var w = root.clientWidth || 1;
      if (tagLo) root.classList.toggle("hide-lo", (pos / 100) * w < tagLo.offsetWidth + 22);
      if (tagHi) root.classList.toggle("hide-hi", ((100 - pos) / 100) * w < tagHi.offsetWidth + 22);
    }

    // Draw a tiny cover-cropped copy of the photo; CSS scales it up with hard pixel edges.
    function drawPixels() {
      if (!hi.complete || !hi.naturalWidth) return;
      var box = root.getBoundingClientRect();
      if (!box.width || !box.height) return;
      var frame = box.width / box.height;
      var iw = hi.naturalWidth;
      var ih = hi.naturalHeight;
      var focusX = 0.3; // matches object-position: 30% 50%
      var focusY = 0.5;
      var sx, sy, sw, sh;
      if (iw / ih > frame) {
        sh = ih;
        sw = ih * frame;
        sx = (iw - sw) * focusX;
        sy = 0;
      } else {
        sw = iw;
        sh = iw / frame;
        sx = 0;
        sy = (ih - sh) * focusY;
      }
      var cols = LOW_RES_COLUMNS;
      var rows = Math.max(1, Math.round(cols / frame));
      canvas.width = cols;
      canvas.height = rows;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      try {
        ctx.drawImage(hi, sx, sy, sw, sh, 0, 0, cols, rows);
        root.classList.add("is-pixel");
      } catch (e) {
        /* keep the blurred fallback */
      }
    }

    if (hi.complete) drawPixels();
    hi.addEventListener("load", drawPixels);
    if ("ResizeObserver" in window) {
      var lastRatio = 0;
      new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        var ratio = Math.round((r.width / r.height) * 100);
        if (ratio !== lastRatio) {
          lastRatio = ratio;
          drawPixels();
        }
        setPos(pos);
      }).observe(root);
    }

    setPos(pos);
    if (isStatic) return;

    // Pointer dragging (mouse, pen, touch). touch-action: pan-y keeps vertical page scroll working.
    var dragging = false;
    function fromEvent(e) {
      var box = root.getBoundingClientRect();
      setPos(((e.clientX - box.left) / box.width) * 100);
    }
    root.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
    root.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      touched = true;
      root.classList.add("is-dragging");
      if (root.setPointerCapture) root.setPointerCapture(e.pointerId);
      fromEvent(e);
      if (range) range.focus({ preventScroll: true });
    });
    root.addEventListener("pointermove", function (e) {
      if (dragging) fromEvent(e);
    });
    function stop() {
      dragging = false;
      root.classList.remove("is-dragging");
    }
    root.addEventListener("pointerup", function (e) {
      if (dragging) fromEvent(e);
      stop();
    });
    root.addEventListener("pointercancel", stop);

    if (range) {
      range.addEventListener("input", function () {
        touched = true;
        setPos(parseFloat(range.value));
      });
    }

    // One gentle nudge the first time it scrolls into view, so people know it moves.
    if (!reduceMotion && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          setTimeout(function () {
            if (!touched) nudge();
          }, 500);
        },
        { threshold: 0.6 }
      );
      io.observe(root);
    }

    function nudge() {
      var start = pos;
      var keys = [start, 28, 72, start];
      var dur = 2200;
      var t0 = null;
      function ease(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }
      function frame(ts) {
        if (touched) return;
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var seg = Math.min(keys.length - 2, Math.floor(p * (keys.length - 1)));
        var local = p * (keys.length - 1) - seg;
        setPos(keys[seg] + (keys[seg + 1] - keys[seg]) * ease(local));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }

  document.querySelectorAll(".compare").forEach(initCompare);

  /* ---------------- Mobile menu ---------------- */

  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------------- Quote form prefill ---------------- */

  var select = document.getElementById("finish");
  var details = document.getElementById("details");

  function chooseOption(sel, value) {
    if (!sel || !value) return;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].text === value) {
        sel.selectedIndex = i;
        return;
      }
    }
  }

  document.querySelectorAll("[data-finish]").forEach(function (link) {
    link.addEventListener("click", function () {
      chooseOption(select, link.getAttribute("data-finish"));
    });
  });

  var params = new URLSearchParams(window.location.search);
  chooseOption(select, params.get("service"));
  if (params.get("item") && details && !details.value) {
    details.value = "I'd like to order: " + params.get("item") + "\nQuantity: \nSizes / colors: \n";
  }

  /* ---------------- Forms: open a pre-filled email ---------------- */

  var INBOX = "sales@mooreimpressions.com";

  document.querySelectorAll(".mail-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.reportValidity && !form.reportValidity()) return;
      var lines = [];
      var name = "";
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "submit") return;
        var v = (el.value || "").trim();
        if (el.name === "Name") name = v;
        if (!v) return;
        lines.push(el.tagName === "TEXTAREA" ? "\n" + el.name + ":\n" + v : el.name + ": " + v);
      });
      var subject = (form.getAttribute("data-subject") || "Website message") + (name ? " from " + name : "");
      var href =
        "mailto:" + INBOX + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      var status = form.querySelector(".form-status");
      if (status) {
        status.innerHTML =
          "Your email app should open with your message filled in. Just press send. Nothing opened? Email us at " +
          '<a href="mailto:' + INBOX + '">' + INBOX + "</a> or call (864) 214-4231.";
      }
      window.location.href = href;
    });
  });

  /* ---------------- Scrolling work strip ---------------- */

  document.querySelectorAll(".marquee__track").forEach(function (track) {
    if (reduceMotion) return;
    // Duplicate the photos once so the loop is seamless (track animates to -50%).
    Array.prototype.slice.call(track.children).forEach(function (li) {
      var copy = li.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      var img = copy.querySelector("img");
      if (img) img.alt = "";
      track.appendChild(copy);
    });
  });

  /* ---------------- Gallery: filters + lightbox ---------------- */

  var grid = document.querySelector(".gallery-grid");
  if (grid) {
    var items = Array.prototype.slice.call(grid.querySelectorAll(".gallery-item"));
    var filters = document.querySelectorAll(".filter");
    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-filter");
        filters.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        items.forEach(function (li) {
          li.hidden = !(cat === "all" || li.getAttribute("data-cat") === cat);
        });
      });
    });

    var box = document.querySelector(".lightbox");
    if (box && typeof box.showModal === "function") {
      var boxImg = box.querySelector("img");
      var boxCap = box.querySelector("figcaption");
      var current = 0;
      var visible = function () {
        return items.filter(function (li) {
          return !li.hidden;
        });
      };
      var show = function (li) {
        var btn = li.querySelector("button");
        var img = li.querySelector("img");
        boxImg.src = btn.getAttribute("data-full");
        boxImg.alt = img.alt;
        boxCap.textContent = li.querySelector(".gallery-cap").textContent;
        current = visible().indexOf(li);
      };
      var step = function (d) {
        var list = visible();
        if (!list.length) return;
        show(list[(current + d + list.length) % list.length]);
      };
      items.forEach(function (li) {
        li.querySelector("button").addEventListener("click", function () {
          show(li);
          box.showModal();
        });
      });
      box.querySelector(".lightbox__close").addEventListener("click", function () {
        box.close();
      });
      box.querySelector(".lightbox__prev").addEventListener("click", function () {
        step(-1);
      });
      box.querySelector(".lightbox__next").addEventListener("click", function () {
        step(1);
      });
      box.addEventListener("click", function (e) {
        if (e.target === box || e.target.tagName === "FIGURE") box.close();
      });
      box.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      });
    }
  }

  /* ---------------- Reveal on scroll ---------------- */

  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var rio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            rio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      rio.observe(el);
    });
  }
})();
