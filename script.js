const UB_CONFIG = {
  downloadUrl: "downloads/ubridge.ankiaddon",   // the add-on file, next to the page (null hides every Download button)
  downloadVersion: "1.0",   // manifest.json human_version of that file
  downloadSize: "124 KB",   // its size: 124,250 bytes, as a Mac shows it (1 KB = 1000 bytes)
  ankiwebId: null,          // e.g. "1234567890" once published -> install code + AnkiWeb link appear too
  chromeStoreUrl: null,     // Chrome Web Store URL once listed
  githubUrl: "https://github.com/mattccorrell-svg/anki-addons",
  issuesUrl: "https://github.com/mattccorrell-svg/anki-addons/issues",
  kofiUrl: "https://ko-fi.com/mccorrell",
};

/* UBridge site behaviour. No dependencies; everything here is progressive enhancement:
   without it the page shows its default state (the Download buttons, "Coming soon" for
   AnkiWeb and the Chrome Web Store) and every section, at rest. */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Install states (one source of truth: UB_CONFIG) ---------- */
  function applyConfig() {
    const id = UB_CONFIG.ankiwebId ? String(UB_CONFIG.ankiwebId).trim() : "";
    const store = UB_CONFIG.chromeStoreUrl ? String(UB_CONFIG.chromeStoreUrl).trim() : "";
    const dl = UB_CONFIG.downloadUrl ? String(UB_CONFIG.downloadUrl).trim() : "";
    const state = {
      "dl-a": !dl, "dl-b": !!dl,
      "anki-a": !id, "anki-b": !!id,
      "chrome-a": !store, "chrome-b": !!store,
    };
    // data-when="dl-b anki-a": shown only when every listed state holds; "dl-b|anki-b": when either does
    document.querySelectorAll("[data-when]").forEach((el) => {
      el.hidden = !el.dataset.when.split("|").some((all) => all.trim().split(/\s+/).every((k) => state[k]));
    });
    const fills = {
      ankiwebId: id,
      downloadVersion: UB_CONFIG.downloadVersion || "",
      downloadSize: UB_CONFIG.downloadSize || "",
    };
    document.querySelectorAll("[data-fill]").forEach((el) => {
      const v = fills[el.dataset.fill];
      if (v != null && (v || el.dataset.fill === "ankiwebId")) el.textContent = v;
    });

    const hrefs = {
      downloadUrl: dl,
      ankiweb: id ? "https://ankiweb.net/shared/info/" + encodeURIComponent(id) : "",
      chromeStoreUrl: store,
      githubUrl: UB_CONFIG.githubUrl,
      issuesUrl: UB_CONFIG.issuesUrl,
      kofiUrl: UB_CONFIG.kofiUrl,
    };
    document.querySelectorAll("[data-href]").forEach((a) => {
      const url = hrefs[a.dataset.href];
      if (url) a.setAttribute("href", url);
    });

    document.querySelectorAll(".copy-btn").forEach((btn) => {
      if (id) btn.setAttribute("aria-label", "Copy install code " + id);
    });
  }

  /* ---------- Copy buttons ---------- */
  function selectText(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing more we can do */ }
  }

  function setupCopy() {
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      const target = document.getElementById(btn.dataset.copyTarget);
      const card = btn.closest(".state") || btn.parentElement;
      const status = card ? card.querySelector(".copy-status") : null;
      const label = btn.querySelector(".copy-label");
      let timer = 0;

      const succeed = () => {
        btn.setAttribute("data-copied", "");
        if (label) label.textContent = "Copied";
        if (status) status.textContent = "Copied";
        clearTimeout(timer);
        timer = setTimeout(() => {
          btn.removeAttribute("data-copied");
          if (label) label.textContent = "Copy code";
          if (status) status.textContent = "";
        }, 2000);
      };
      const fallback = () => {
        if (target) selectText(target);
        if (status) status.textContent = "Select the code and press Ctrl+C (⌘C on a Mac).";
      };

      btn.addEventListener("click", () => {
        const text = target ? target.textContent.trim() : "";
        if (!text) return;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(succeed, fallback);
          } else {
            fallback();
          }
        } catch (e) {
          fallback();
        }
      });
    });
  }

  /* ---------- Theme toggle: system -> light -> dark, with a soft cross-fade ---------- */
  const THEME_COLOR = { light: "#ffffff", dark: "#08121e" };
  function setupTheme() {
    const btn = document.querySelector(".theme-toggle");
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
    metas.forEach((m) => { m.dataset.auto = m.getAttribute("content"); });
    const labels = { system: "Theme: match system", light: "Theme: light", dark: "Theme: dark" };
    const read = () => {
      const t = root.getAttribute("data-theme");
      return t === "light" || t === "dark" ? t : "system";
    };
    const paint = (mode) => {
      metas.forEach((m) => m.setAttribute("content", mode === "system" ? m.dataset.auto : THEME_COLOR[mode]));
      if (!btn) return;
      btn.dataset.mode = mode;
      btn.setAttribute("aria-label", labels[mode]);
    };
    paint(read());
    if (!btn) return;
    let vt = null;                                  // the cross-fade in progress, if any
    let cur = read();                               // tracked here, so a click mid-fade steps on from the new mode
    const cycle = () => {
      const next = { system: "light", light: "dark", dark: "system" }[cur];
      cur = next;
      const apply = () => {
        if (next === "system") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", next);
        paint(next);
      };
      try {
        if (next === "system") localStorage.removeItem("ub-theme");
        else localStorage.setItem("ub-theme", next);
      } catch (e) { /* storage blocked: the choice lasts for this page view */ }
      if (vt) { vt.skipTransition(); apply(); return; }   // a quick second click: jump straight there
      if (document.startViewTransition && !reduceMotion.matches) {
        try {
          vt = document.startViewTransition(apply);
          vt.finished.finally(() => { vt = null; });
          return;
        } catch (e) { vt = null; /* fall through */ }
      }
      apply();
    };
    btn.addEventListener("click", cycle);
    // During the cross-fade, clicks land on <html> rather than the button: send ones on its spot back to it.
    root.addEventListener("click", (e) => {
      if (!vt || e.target !== root) return;
      const r = btn.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) cycle();
    });
  }

  /* ---------- Mobile menu ---------- */
  function setupMenu() {
    const header = document.querySelector(".site-header");
    const btn = document.querySelector(".menu-toggle");
    const menu = document.getElementById("nav-menu");
    if (!header || !btn || !menu) return;
    const set = (open) => {
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
      header.classList.toggle("menu-open", open);
    };
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (btn.getAttribute("aria-expanded") === "true" && !header.contains(e.target)) set(false);
    });
    window.matchMedia("(min-width: 920px)").addEventListener("change", (m) => { if (m.matches) set(false); });
  }

  /* ---------- Nav: an underline that slides to the hovered (or focused) link ---------- */
  function setupNavInk() {
    const nav = document.querySelector(".site-nav");
    const list = document.getElementById("nav-menu");
    if (!nav || !list) return;
    const ink = document.createElement("span");
    ink.className = "nav-ink";
    ink.setAttribute("aria-hidden", "true");
    nav.appendChild(ink);
    const BASE = 100;                               // .nav-ink's CSS width; scaleX sizes it
    const moveTo = (a) => {
      const n = nav.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      const inset = 12;                             // the link's side padding: the line sits under its text
      const fresh = !ink.classList.contains("is-on");
      if (fresh) ink.classList.add("is-jump");      // appear in place rather than slide in from the left
      ink.style.setProperty("--x", (r.left - n.left + inset).toFixed(1) + "px");
      ink.style.setProperty("--s", ((r.width - inset * 2) / BASE).toFixed(3));
      if (fresh) { void ink.offsetWidth; ink.classList.remove("is-jump"); }
      ink.classList.add("is-on");
    };
    const hide = () => ink.classList.remove("is-on");
    list.addEventListener("pointerover", (e) => {
      const a = e.target.closest("a");
      if (a && e.pointerType === "mouse") moveTo(a);
    });
    list.addEventListener("pointerleave", hide);
    list.addEventListener("focusin", (e) => { const a = e.target.closest("a"); if (a && a.matches(":focus-visible")) moveTo(a); });
    list.addEventListener("focusout", hide);
  }

  /* ---------- Scroll reveals ----------
     Progressive enhancement: only with IntersectionObserver and motion allowed (html.reveal-on).
     Nothing is hidden until the visitor first scrolls, and then only items (.r) sitting just
     below the viewport, about to scroll in. Items that arrive together come in ~70ms apart,
     in reading order (a section's heading first). Failsafe: anything still hidden 2.5s after it
     was hidden is shown once it's on screen; printing, a jump to an anchor or a hash change
     shows everything. */
  function showAllReveals() {
    document.querySelectorAll(".is-pending").forEach((el) => el.classList.remove("is-pending"));
  }

  function setupReveal() {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
    const items = [...document.querySelectorAll(".r")];
    if (!items.length) return;
    root.classList.add("reveal-on");

    const timers = new Map();
    const done = (el) => {
      clearTimeout(timers.get(el));
      timers.delete(el);
      el.classList.remove("is-pending");
      near.unobserve(el);
      inView.unobserve(el);
    };
    const arm = (el) => {
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => {
        if (!el.classList.contains("is-pending")) return;
        if (el.getBoundingClientRect().top < window.innerHeight) done(el);   // on screen, but still hidden
        else arm(el);
      }, 2500));
    };

    // Watch the page's own viewport (root: document), so the margins still count when the page
    // sits inside an iframe (the claude.ai preview); older browsers fall back to the default root.
    const io = (cb, margin) => {
      try { return new IntersectionObserver(cb, { root: document, rootMargin: margin }); }
      catch (e) { return new IntersectionObserver(cb, { rootMargin: margin }); }
    };

    const near = io((entries) => {
      entries.forEach((en) => {
        const el = en.target;
        const below = en.boundingClientRect.top > window.innerHeight;
        if (en.isIntersecting && below) {
          if (!el.classList.contains("is-pending")) {
            el.style.removeProperty("--d");
            el.classList.add("is-pending");
            arm(el);
          }
        } else if (!en.isIntersecting) {
          el.classList.remove("is-pending");
        }
      });
    }, "0px 0px 40% 0px");

    const inView = io((entries) => {
      const batch = entries.filter((en) => en.isIntersecting).map((en) => en.target);
      batch.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      let k = 0;
      batch.forEach((el) => {
        if (el.classList.contains("is-pending")) {
          const group = el.closest("[data-stagger]");
          const step = group ? +group.dataset.stagger : 70;
          const order = el.dataset.i != null ? Math.min(+el.dataset.i, k) : k;
          el.style.setProperty("--d", Math.min(order, 9) * step + "ms");
          k++;
          void el.offsetWidth;                         // commit the hidden state so the fade runs
        }
        done(el);
      });
    }, "0px 0px -8% 0px");

    // At rest the page is complete: start watching only once the visitor scrolls.
    const start = () => {
      window.removeEventListener("scroll", start);
      const fold = window.innerHeight;
      items.forEach((el) => {
        if (!el.getClientRects().length) return;                // hidden (another install state, a phone-only layout)
        if (el.getBoundingClientRect().top < fold) return;      // already on screen (or above): leave it be
        near.observe(el);
        inView.observe(el);
      });
    };
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("beforeprint", showAllReveals);
    window.addEventListener("hashchange", showAllReveals);
  }

  /* ---------- Hero screenshot: a slight rise and scale as it scrolls past ----------
     Transform only, one rAF per frame, and only while the hero is on screen. */
  function setupHeroDepth() {
    const el = document.querySelector(".hero-shot");
    if (!el || reduceMotion.matches || !("IntersectionObserver" in window)) return;
    let ticking = false, active = false;
    const update = () => {
      ticking = false;
      const end = el.offsetTop + el.offsetHeight;                // scrolled this far, the shot is gone
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, end)));
      el.style.transform = p ? "translate3d(0," + (-p * 28).toFixed(1) + "px,0) scale(" + (1 + p * 0.035).toFixed(4) + ")" : "";
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      if (on === active) return;
      active = on;
      if (on) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }
      else window.removeEventListener("scroll", onScroll);
    }).observe(el);
  }

  /* ---------- In-page links: smooth on click only (programmatic jumps stay instant); focus follows ---------- */
  function setupAnchors() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const hash = a.getAttribute("href");
      if (hash.length < 2) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      showAllReveals();
      if (target.tagName === "DETAILS") target.open = true;
      const behavior = reduceMotion.matches ? "auto" : "smooth";
      if (hash === "#top") window.scrollTo({ top: 0, behavior });
      else target.scrollIntoView({ behavior, block: "start" });
      try { history.pushState(null, "", hash); } catch (err) { /* file:// or sandboxed */ }
      if (hash !== "#top") {
        if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(target.tagName)) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- A link straight to a <details> (e.g. #privacy-extension) opens it ---------- */
  function openLinkedDetails() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el && el.tagName === "DETAILS") el.open = true;
  }

  /* ---------- Download buttons: the file downloads, then the install steps come into view ----------
     Clicked anywhere above the install section, the page glides down to it, step 1 ticks off and
     a short line points to step 2. The download itself is the link's own (href + download). */
  function setupDownload() {
    const install = document.getElementById("install");
    const card = document.querySelector(".install-card--anki");
    const status = card ? card.querySelector(".dl-status") : null;
    document.querySelectorAll("[data-dl]").forEach((a) => {
      a.addEventListener("click", () => {
        if (card) card.classList.add("dl-started");
        if (status) status.textContent = "Your download should start now. Next: step 2.";
        if (!install || a.closest("#install")) return;
        setTimeout(() => {
          showAllReveals();
          install.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
        }, 250);
      });
    });
  }

  /* ---------- Go ---------- */
  applyConfig();
  setupCopy();
  setupDownload();
  setupTheme();
  setupMenu();
  setupNavInk();
  setupAnchors();
  openLinkedDetails();
  window.addEventListener("hashchange", openLinkedDetails);
  setupReveal();
  setupHeroDepth();
})();
