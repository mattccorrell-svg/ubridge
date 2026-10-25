const UB_CONFIG = {
  downloadUrl: "downloads/ubridge.ankiaddon",   // the add-on file, next to the page (null hides every Download button)
  downloadVersion: "1.0",   // manifest.json human_version of that file
  downloadSize: "131 KB",   // its size: 130,811 bytes, as a Mac shows it (1 KB = 1000 bytes)
  ankiwebId: null,          // e.g. "1234567890" once published -> install code + AnkiWeb link appear too
  chromeStoreUrl: "https://chromewebstore.google.com/detail/bpibpcglpcpooipnhocajaldklapkfja", // Chrome Web Store URL once listed
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
    // pointerdown, not click: iOS Safari sends no click for a tap on plain text or background
    document.addEventListener("pointerdown", (e) => {
      if (btn.getAttribute("aria-expanded") === "true" && !header.contains(e.target)) set(false);
    });
    const wide = window.matchMedia("(min-width: 920px)");
    const onWide = (m) => { if (m.matches) set(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    else if (wide.addListener) wide.addListener(onWide);         // Safari before 14
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

  /* ---------- Hero tabs: Find Cards / Find Questions, like the add-on's own switch ----------
     ARIA tabs with a roving tabindex (Left/Right, Home/End). The new shot fades in over the old
     one (instant with reduced motion). Find Questions starts hidden and lazy: it's let in to load
     once the page has, or as soon as someone points at its tab. Without JS: Find Cards alone. */
  function setupHeroTabs() {
    const list = document.querySelector(".shot-tabs");
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    const panelOf = (tab) => document.getElementById(tab.getAttribute("aria-controls"));
    const wake = (panel) => {                       // let a hidden panel's lazy images load, still unseen
      if (!panel.hidden) return;
      panel.classList.add("is-off");
      panel.hidden = false;
      panel.querySelectorAll("img").forEach((i) => { if (i.offsetParent) i.loading = "eager"; });   // this theme's copy only
    };
    const ready = (panel) => {                      // wait (briefly) for the shot on show to decode
      const img = Array.from(panel.querySelectorAll("img")).find((i) => i.offsetParent);
      if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
      const done = img.decode ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = img.onerror = r; });
      return Promise.race([done, new Promise((r) => setTimeout(r, 700))]);
    };
    let current = tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
    let pending = 0;
    const select = (tab, focus) => {
      if (focus) tab.focus();
      if (tab === current) return;
      const from = panelOf(current), to = panelOf(tab);
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      current = tab;
      const ticket = ++pending;
      wake(to);
      ready(to).then(() => {
        if (ticket !== pending) return;             // a quicker second click won
        tabs.forEach((t) => {
          const p = panelOf(t);
          if (p !== to && p.classList.contains("is-on")) { p.classList.remove("is-on"); p.classList.add("is-off"); }
        });
        if (from !== to) {
          to.classList.add("is-entering", "is-on");
          to.classList.remove("is-off");
          void to.offsetWidth;                      // start the fade from 0
          to.classList.remove("is-entering");
        }
      });
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        let j = -1;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j < 0) return;
        e.preventDefault();
        select(tabs[j], true);
      });
      tab.addEventListener("pointerenter", () => wake(panelOf(tab)), { once: true });
      tab.addEventListener("focus", () => wake(panelOf(tab)), { once: true });
    });
    list.hidden = false;
    const wakeAll = () => tabs.forEach((t) => wake(panelOf(t)));
    const later = () => (window.requestIdleCallback ? requestIdleCallback(wakeAll, { timeout: 2500 }) : setTimeout(wakeAll, 800));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
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
     a short line points to step 2. The download itself is the link's own (href + download).
     On a phone or tablet (touch only, not Windows) Anki can't install the file, so step 1 doesn't
     tick off and the line says to open the page on a computer instead. */
  function setupDownload() {
    const install = document.getElementById("install");
    const card = document.querySelector(".install-card--anki");
    const status = card ? card.querySelector(".dl-status") : null;
    const onPhone = () =>
      window.matchMedia("(hover: none) and (pointer: coarse)").matches && !/Windows/.test(navigator.userAgent);
    document.querySelectorAll("[data-dl]").forEach((a) => {
      a.addEventListener("click", () => {
        const phone = onPhone();
        if (card && !phone) card.classList.add("dl-started");
        if (status) {
          status.classList.toggle("dl-status--phone", phone);
          status.textContent = phone
            ? "UBridge installs in Anki on a Mac or Windows computer. Open this page there to install it."
            : "Your download should start now. Next: step 2.";
        }
        const inside = !!a.closest("#install");
        if (!install || (inside && !phone)) return;
        setTimeout(() => {
          showAllReveals();
          const behavior = reduceMotion.matches ? "auto" : "smooth";
          // on a phone the line about using a computer is what matters, so bring that into view
          if (phone && status) status.scrollIntoView({ behavior, block: inside ? "nearest" : "center" });
          else install.scrollIntoView({ behavior, block: "start" });
        }, 250);
      });
    });
  }

  /* ---------- A fresh visit opens at the top ----------
     Phones often reopen a page partway down (a reload, a tab coming back, a search result's
     text highlight, an in-app browser), and with the header pinned a small leftover offset
     hides the headline. Until the visitor touches, scrolls or types, keep the page at the top.
     A link to a section (#install) still lands there. */
  function keepTopOnArrival() {
    if (location.hash.length > 1) return;
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) { /* sandboxed */ }
    const events = ["touchstart", "pointerdown", "wheel", "keydown"];
    let touched = false;
    const stop = () => {
      touched = true;
      events.forEach((t) => window.removeEventListener(t, stop, true));
    };
    events.forEach((t) => window.addEventListener(t, stop, { capture: true, passive: true }));
    const toTop = () => {
      if (!touched && location.hash.length < 2 && window.scrollY > 0) window.scrollTo(0, 0);
    };
    toTop();
    window.addEventListener("load", () => { toTop(); setTimeout(toTop, 150); });
    setTimeout(toTop, 400);
    setTimeout(toTop, 1200);
    setTimeout(stop, 3000);                     // after that, the page is the visitor's
    window.addEventListener("pageshow", (e) => { if (!e.persisted) toTop(); });
  }

  /* ---------- Go ---------- */
  keepTopOnArrival();
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
  setupHeroTabs();
  setupHeroDepth();
})();
