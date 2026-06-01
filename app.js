/* ============================================================
   SVERGOLD — app.js : controls, scroll journey, form
   ============================================================ */
(function () {
  "use strict";
  const prefs = window.__svergold || { lang: "he", theme: "light" };
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  // Opt into the hidden->reveal animation only now that JS is running.
  document.documentElement.classList.add("js");

  /* ---------- init language ---------- */
  applyLang(prefs.lang);
  $$(".lang-switch button").forEach(btn => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });

  /* ---------- theme ---------- */
  const themeToggle = $("#themeToggle");
  themeToggle && themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  /* ---------- header scrolled + scroll progress ---------- */
  const header = $("#header");
  const prog = $("#scrollProg");
  function onScrollChrome() {
    const y = window.scrollY || window.pageYOffset;
    header.classList.toggle("scrolled", y > 30);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
  }

  /* ---------- mobile menu ---------- */
  const menuBtn = $("#menuBtn"), mobileMenu = $("#mobileMenu");
  function closeMenu() { mobileMenu.classList.remove("open"); menuBtn.classList.remove("open"); document.body.style.overflow = ""; }
  menuBtn && menuBtn.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    menuBtn.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$("#mobileMenu a").forEach(a => a.addEventListener("click", closeMenu));

  /* ---------- reveal on scroll (rect-based; no IntersectionObserver dependency) ---------- */
  const revealEls = $$(".reveal");
  function revealCheck() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (let i = 0; i < revealEls.length; i++) {
      const el = revealEls[i];
      if (el.classList.contains("in")) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add("in");
    }
  }
  if (reduced) {
    revealEls.forEach(el => el.classList.add("in"));
  } else {
    // Above-the-fold: reveal instantly with NO transition so a throttled/frozen
    // transition can never leave the first screen blank. Below-the-fold animate in.
    const vh0 = window.innerHeight || document.documentElement.clientHeight;
    revealEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < vh0 && r.bottom > 0) el.classList.add("no-anim", "in");
    });
    requestAnimationFrame(revealCheck);
    setTimeout(revealCheck, 250);
  }

  /* ---------- journey: IMAGE-SEQUENCE scroll scrub + synced UI ----------
     Premium, seek-free smoothness (Apple-style):
       - section geometry cached off the hot path  → no per-frame reflow
       - per frame read only window.scrollY, lerp-damp it → a cinematic glide
       - paint the frame for that progress to a <canvas> → zero video-decode jank
       - route fill (GPU transform), dots, active station and readout all run off the
         SAME smoothed progress so ship + route + containers + text stay in lockstep. */
  const inner = $(".journey-inner");
  const routeFill = $("#routeFill");
  const route = $("#route");
  const canvas = $("#journeyCanvas");
  const stageEl = $(".cine-stage");
  const jStep = $("#jStep"), jNow = $("#jNow");
  const stations = $$(".station");
  const STAGES = stations.length; // 6
  let curIndex = -1;
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const scrubEnabled = isDesktop && !reduced;   // mobile / reduced-motion: single still frame

  // route dots
  for (let i = 0; i < STAGES; i++) {
    const d = document.createElement("span");
    d.className = "route-dot dot";
    d.style.top = (i / (STAGES - 1)) * 100 + "%";
    if (route) route.appendChild(d);
  }
  const dots = route ? $$(".dot", route) : [];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function updateReadout(index) {
    const h3 = stations[index] && $("h3", stations[index]);
    if (jNow && h3) jNow.textContent = h3.textContent;
    if (jStep) jStep.innerHTML = pad(index + 1) + '<span class="tot">/' + pad(STAGES) + '</span>';
  }

  // cached section geometry — measured only on resize/load, never per frame
  let secTop = 0, secTravel = 1;
  function measureJourney() {
    if (!inner) return;
    const r = inner.getBoundingClientRect();
    secTop = r.top + window.scrollY;
    secTravel = Math.max(1, inner.offsetHeight - window.innerHeight);
  }
  measureJourney();
  window.addEventListener("resize", measureJourney, { passive: true });
  window.addEventListener("load", measureJourney);
  setTimeout(measureJourney, 1200);   // re-measure after late media settles layout

  // image sequence (60 frames → smooth scrub, no video seeking)
  const SEQ_N = 60;
  const ctx2d = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const frames = new Array(SEQ_N);
  let seqReady = false, lastFrame = -1;
  function paintFrame(i) {
    if (!ctx2d) return;
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    if (canvas.width !== img.naturalWidth) { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; }
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  function preloadSequence() {
    let done = 0;
    for (let i = 0; i < SEQ_N; i++) {
      const im = new Image();
      im.decoding = "async";
      im.onload = im.onerror = () => {
        if (++done === SEQ_N) {
          seqReady = true;
          if (stageEl) stageEl.classList.add("seq-ready");
          paintFrame(lastFrame < 0 ? 0 : lastFrame);
        }
      };
      im.src = "assets/journey-seq/f_" + pad(i) + ".jpg";
      frames[i] = im;
    }
  }
  if (scrubEnabled && canvas) {
    // lazy-load the ~2MB sequence only as the journey nears the viewport
    if ("IntersectionObserver" in window && inner) {
      const io = new IntersectionObserver((ents) => {
        if (ents.some(e => e.isIntersecting)) { io.disconnect(); preloadSequence(); }
      }, { rootMargin: "80% 0px" });
      io.observe(inner);
    } else {
      preloadSequence();
    }
  } else if (stageEl) {
    stageEl.classList.add("seq-static");   // mobile / reduced-motion → single still frame
  }

  // one persistent rAF: glide the progress, paint the frame, sync the UI.
  // Pauses entirely when the tab is hidden (no wasted frames / battery).
  let smooth = 0, running = false, rafId = 0;
  function journeyFrame() {
    if (!running) return;
    const target = Math.min(1, Math.max(0, (window.scrollY - secTop) / secTravel));
    smooth += (target - smooth) * 0.12;     // gentle lerp → cinematic, never jumpy
    if (smooth < 0.0002) smooth = 0; else if (smooth > 0.9998) smooth = 1;

    if (scrubEnabled && seqReady) {
      const fi = Math.min(SEQ_N - 1, Math.max(0, Math.round(smooth * (SEQ_N - 1))));
      if (fi !== lastFrame) { paintFrame(fi); lastFrame = fi; }
    }

    if (routeFill) routeFill.style.setProperty("--p", smooth.toFixed(4));   // GPU scaleY, no layout
    const index = Math.min(STAGES - 1, Math.floor(smooth * STAGES + 0.0001));
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("on", index >= i);
    for (let i = 0; i < stations.length; i++) stations[i].classList.toggle("active", i === index);
    if (index !== curIndex) { curIndex = index; updateReadout(index); }

    rafId = requestAnimationFrame(journeyFrame);
  }
  function startJourneyLoop() { if (inner && !running) { running = true; rafId = requestAnimationFrame(journeyFrame); } }
  function stopJourneyLoop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  startJourneyLoop();
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopJourneyLoop(); else startJourneyLoop(); });

  /* ---------- rAF scroll loop (chrome + reveal; journey runs its own rAF) ---------- */
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { onScrollChrome(); revealCheck(); ticking = false; });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScrollChrome, { passive: true });
  onScrollChrome();
  // refresh localized readout when language changes
  document.addEventListener("svergold:langchange", () => { if (curIndex >= 0) updateReadout(curIndex); });

  /* ---------- stat counters (count up when the band scrolls into view) ---------- */
  const statSection = $(".stats");
  if (statSection && !reduced && "IntersectionObserver" in window) {
    const numEls = $$(".stat .num > span:not(.suf)");
    let counted = false;
    const animateCount = (el) => {
      const target = parseInt((el.textContent || "").replace(/\D/g, ""), 10);
      if (!isFinite(target) || target <= 0) return;
      const dur = 1300, t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick); else el.textContent = String(target);
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver((ents) => {
      if (!counted && ents.some(e => e.isIntersecting)) { counted = true; cio.disconnect(); numEls.forEach(animateCount); }
    }, { threshold: 0.4 });
    cio.observe(statSection);
  }

  /* ---------- contact form ---------- */
  const form = $("#contactForm");
  if (form) {
    const success = $("#formSuccess");
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const clearErr = (id) => { const f = $("#" + id); f && f.classList.remove("invalid"); };
    $$("#contactForm input, #contactForm textarea").forEach(el => {
      el.addEventListener("input", () => { const fld = el.closest(".field"); fld && fld.classList.remove("invalid"); });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const msg = form.message.value.trim();
      let ok = true, firstBad = null;
      const mark = (id, bad) => {
        const f = $("#" + id); if (!f) return;
        f.classList.toggle("invalid", bad);
        if (bad && !firstBad) firstBad = $("input,textarea", f);
        if (bad) ok = false;
      };
      mark("f-name", !name);
      mark("f-email", !emailRe.test(email));
      mark("f-msg", !msg);
      if (!ok) { firstBad && firstBad.focus(); return; }
      form.style.display = "none";
      success.classList.add("show");
    });
  }

  /* ---------- year ---------- */
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- hero video (V1 diving ship) ---------- */
  const heroVid = $(".hero-video");
  if (heroVid) {
    heroVid.muted = true;
    if (reduced) {
      heroVid.removeAttribute("autoplay");
      heroVid.addEventListener("loadeddata", () => { try { heroVid.pause(); } catch (e) {} });
    } else {
      const tryPlay = () => { const p = heroVid.play(); if (p && p.catch) p.catch(() => {}); };
      heroVid.addEventListener("canplay", tryPlay, { once: true });
      tryPlay();
      // pause when scrolled offscreen to keep performance good
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) tryPlay(); else { try { heroVid.pause(); } catch (err) {} } });
        }, { threshold: 0.05 }).observe(heroVid);
      }
    }
  }
})();
