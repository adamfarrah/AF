/* ═══════════════════════════════════════════════
   Adem Ferrah — Swiss site behaviours (no deps)
   ═══════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── footer year ── */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── take control of scroll BEFORE any paint jump can happen ── */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  /* ── intro veil: plays once per session, skippable, reduced-motion-safe ── */
  var intro = document.getElementById("intro");
  var introPending = false, introTimer = 0, skipIntro = null;
  function initReveals() {
    var reveals = document.querySelectorAll("[data-reveal]");
    if ("IntersectionObserver" in window) {
      var ro = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add("is-in");
              ro.unobserve(en.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      reveals.forEach(function (el) { ro.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    }
  }
  function endIntro() {
    if (!introPending) return;
    introPending = false;
    clearTimeout(introTimer);
    window.removeEventListener("pointerdown", skipIntro);
    window.removeEventListener("keydown", skipIntro);
    window.removeEventListener("wheel", skipIntro);
    document.documentElement.classList.add("intro-done");
    document.documentElement.classList.remove("intro-lock");
    if (document._introPin) {
      document.removeEventListener("scroll", document._introPin);
      document._introPin = null;
    }
    setTimeout(function () {
      if (intro && intro.parentNode) intro.remove();
      initReveals();
    }, 600);
  }
  if (intro) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
    /* replays on every reload by design (no session memory) */
    if (reduce) {
      intro.remove();
      initReveals();
    } else {
      introPending = true;
      skipIntro = function () { endIntro(); };
      document.documentElement.classList.add("intro-lock");
      var pin = function () { window.scrollTo(0, 0); };
      document.addEventListener("scroll", pin, { passive: true });
      document._introPin = pin;
      introTimer = setTimeout(endIntro, 3600);   // CSS self-out starts 3.05s (no-JS fallback)
      window.addEventListener("pointerdown", skipIntro);
      window.addEventListener("keydown", skipIntro);
      window.addEventListener("wheel", skipIntro, { passive: true });
    }
  } else {
    initReveals();
  }

  /* ── smooth-but-safe glide ──
     WHY this exists: long native smooth scrolls slide the whole page under
     the cursor, so mousedown/mouseup hit different elements and the browser
     drops every click during the glide — "mouse freezes between sections".
     A custom scroller fixes it: ANY pointerdown instantly SNAPS the glide to
     its destination, freezing the layout, so the user's click lands on a
     still page. Wheel/touch/keys just stop the glide where it is. */
  var glide = { raf: 0, to: null };
  var EASE = function (k) { return k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2; };
  function stopGlide(snapToEnd) {
    if (glide.raf) cancelAnimationFrame(glide.raf);
    glide.raf = 0;
    if (snapToEnd && glide.to !== null) window.scrollTo(0, glide.to);
    glide.to = null;
  }
  function glideTo(y) {
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var to = Math.max(0, Math.min(max, Math.round(y)));
    var from = window.scrollY, delta = to - from;
    stopGlide(false);
    if (Math.abs(delta) < 30 ||
        (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches)) {
      window.scrollTo(0, to);
      return;
    }
    glide.to = to;
    var dur = Math.min(720, 240 + Math.abs(delta) * 0.13);
    var t0 = 0;
    function step(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      window.scrollTo(0, Math.round(from + delta * EASE(k)));
      if (k < 1) glide.raf = requestAnimationFrame(step);
      else { glide.raf = 0; glide.to = null; }
    }
    glide.raf = requestAnimationFrame(step);
  }
  /* a click during a glide: freeze the page AT the destination before the
     mouseup fires, so the click resolves against a stable layout */
  window.addEventListener("pointerdown", function () {
    if (glide.raf) stopGlide(true);
  }, { capture: true, passive: true });
  ["wheel", "touchstart", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, function () { if (glide.raf) stopGlide(false); }, { passive: true });
  });

  /* nav/footer/hero anchors glide through the engine; history is replaced,
     not pushed, so hammering never jams the Back button */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.length < 2) return;
    var y = 0;
    if (href !== "#top") {
      var t = document.querySelector(href);
      if (!t) return;
      var nav = document.querySelector(".nav");
      y = window.scrollY + t.getBoundingClientRect().top
          - ((nav ? nav.offsetHeight : 58) + 8);
    }
    e.preventDefault();
    glideTo(y);
    try { history.replaceState(null, "", href); } catch (err) {}
    if (a.blur) a.blur();
  });

  /* ── active section highlight — rAF-throttled, class-only, passive ──
     never preventDefaults, never touches clicks; if it ever misbehaves it
     is invisible to interaction. */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__links a"));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);
  function mark(a, on) {
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    if (!a.className) a.removeAttribute("class");
  }
  function updateSpy() {
    var line = window.innerHeight * 0.42;
    var cur = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top - 80 <= line) cur = sections[i];
    }
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 6) cur = sections[sections.length - 1];
    links.forEach(function (a) {
      mark(a, !!cur && cur.id === a.getAttribute("href").slice(1));
    });
  }
  if (sections.length) {
    var spyTick = false;
    window.addEventListener("scroll", function () {
      if (spyTick) return;
      spyTick = true;
      requestAnimationFrame(function () { spyTick = false; updateSpy(); });
    }, { passive: true });
    window.addEventListener("resize", updateSpy);
    updateSpy();
  }

  /* ── contact form → mailto (no backend) ── */
  var form = document.getElementById("contactForm");
  var err = document.getElementById("formError");
  var TO = "adamfarrah14@gmail.com";

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var from = (data.get("from") || "").toString().trim();
      var email = (data.get("email") || "").toString().trim();
      var subject = (data.get("subject") || "").toString().trim();
      var message = (data.get("message") || "").toString().trim();

      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      var ok = from && emailOk && subject && message;

      [form.elements.from, form.elements.email, form.elements.subject, form.elements.message]
        .forEach(function (input) {
          var bad =
            input.value.trim() === "" ||
            (input === form.elements.email && !emailOk);
          input.setAttribute("aria-invalid", bad ? "true" : "false");
        });

      if (err) err.hidden = !!ok;
      if (!ok) return;

      var body =
        message +
        "\n\n—\nFrom: " + from + " <" + email + ">\n" +
        "Sent from the Swiss-style portfolio site.";

      window.location.href =
        "mailto:" + TO +
        "?subject=" + encodeURIComponent(subject + " — via adem-ferrah.site") +
        "&body=" + encodeURIComponent(body);

      var btn = form.querySelector("button[type=submit]");
      if (btn) {
        var old = btn.innerHTML;
        btn.innerHTML = "Opening your mail app…";
        btn.disabled = true;
        setTimeout(function () { btn.innerHTML = old; btn.disabled = false; }, 2500);
      }
    });
  }

  /* ── copy address ── */
  var copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      function done() {
        copyBtn.textContent = "Copied ✓";
        setTimeout(function () { copyBtn.textContent = "Copy address"; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(TO).then(done, function () { fallback(done); });
      } else { fallback(done); }

      function fallback(cb) {
        var ta = document.createElement("textarea");
        ta.value = TO;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        cb();
      }
    });
  }
})();
