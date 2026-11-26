/* motion-core.js
 * Small runtime shared by every interaction section.
 * It holds the patterns that kept coming back in the R01–R17 dissections
 * (see references/library.md): time-based smoothing, hand-written springs,
 * fling velocity from the last 100 ms, one rAF loop, a lifecycle contract that
 * pauses off screen, and scroll-progress helpers.
 * No dependencies. If the page uses GSAP, call ticker.useGsap(gsap) so everything
 * runs on one clock with ScrollTrigger and Lenis.
 */

/* ---------- media queries ---------- */
export const mq = (q) => window.matchMedia(q);
export const reducedMotion = () => mq('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => mq('(hover: hover) and (pointer: fine)').matches;
export const smallScreen = () => mq('(max-width: 767px)').matches;

/* ---------- math ---------- */
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, inMin, inMax, outMin = 0, outMax = 1) =>
  outMin + (outMax - outMin) * clamp((v - inMin) / (inMax - inMin));

/** Local 0..1 progress inside the window [a, b] of a global progress p (the "range table" pattern of R02/R03/R12). */
export const range = (p, a, b) => clamp((p - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Frame-rate independent smoothing. lambda is roughly "per second".
 * Example: x = damp(x, target, 8, dt). Never use lerp(x, target, 0.1) per frame:
 * that runs twice as fast on a 120 Hz screen (a real bug found in R06 Scroll Bend).
 */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Convert a reference's "follow factor per frame @60fps" (e.g. 0.12) into a lambda for damp(). */
export const followToLambda = (f) => -Math.log(1 - f) * 60;

export const ease = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

/* ---------- spring ---------- */
/**
 * 1D spring (semi-implicit Euler, sub-stepped at 120 Hz so it stays stable at high stiffness).
 * Values the references use often: stiffness 70–170, damping 9–26.
 */
export function createSpring({ stiffness = 170, damping = 26, mass = 1, value = 0 } = {}) {
  let x = value;
  let v = 0;
  let target = value;
  return {
    get value() { return x; },
    get velocity() { return v; },
    get target() { return target; },
    set(t) { target = t; },
    snap(t) { x = target = t; v = 0; },
    kick(impulse) { v += impulse; },
    isSettled(eps = 1e-3) { return Math.abs(x - target) < eps && Math.abs(v) < eps; },
    step(dt) {
      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = (-stiffness * (x - target) - damping * v) / mass;
        v += a * h;
        x += v * h;
      }
      return x;
    },
  };
}

/* ---------- pointer velocity (fling / throw) ---------- */
/**
 * Pointer velocity from the samples of the last windowMs. If the pointer rested for
 * more than staleMs before release, the velocity is 0 (the R06 Light Table / Infinite Grid rule).
 */
export function createVelocityTracker({ windowMs = 100, staleMs = 80 } = {}) {
  const samples = [];
  return {
    reset() { samples.length = 0; },
    add(x, y, t = performance.now()) {
      samples.push({ x, y, t });
      while (samples.length > 2 && t - samples[0].t > windowMs) samples.shift();
    },
    /** px per second */
    get(now = performance.now()) {
      if (samples.length < 2) return { x: 0, y: 0 };
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (now - last.t > staleMs) return { x: 0, y: 0 };
      const dt = Math.max((last.t - first.t) / 1000, 1 / 120);
      return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    },
  };
}

/* ---------- one loop for everything ---------- */
/** Callbacks receive (dt seconds, time seconds). dt is capped at 1/20 s so nothing jumps when a tab comes back. */
export const ticker = (() => {
  const subs = new Set();
  let raf = 0;
  let last = 0;
  let gsapRef = null;

  const run = (dt, time) => subs.forEach((fn) => fn(Math.min(dt, 1 / 20), time));
  const loop = (now) => {
    run((now - last) / 1000, now / 1000);
    last = now;
    raf = subs.size ? requestAnimationFrame(loop) : 0;
  };
  const start = () => {
    if (gsapRef || raf || !subs.size) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };

  return {
    add(fn) { subs.add(fn); start(); return () => subs.delete(fn); },
    remove(fn) { subs.delete(fn); },
    /** Move the clock to gsap.ticker so it stays in sync with ScrollTrigger and Lenis. */
    useGsap(gsap) {
      if (gsapRef) return;
      gsapRef = gsap;
      cancelAnimationFrame(raf);
      raf = 0;
      gsap.ticker.add((time, deltaMs) => run(deltaMs / 1000, time));
    },
  };
})();

/* ---------- scroll progress ---------- */
/**
 * For a tall section (e.g. 400vh) whose content is position: sticky.
 * 0 when the section top meets the viewport top, 1 when the section bottom meets the viewport bottom.
 */
export function stickyProgress(el) {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  return total > 0 ? clamp(-r.top / total) : 0;
}

/** 0 when the element's top enters at the bottom of the viewport, 1 when its bottom leaves at the top. */
export function passProgress(el) {
  const r = el.getBoundingClientRect();
  return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
}

/* ---------- smooth scroll ---------- */
/** Optional Lenis. Not started under reduced motion (lesson from R08/R09). */
export function setupSmoothScroll({ Lenis, gsap, ScrollTrigger, lerp: l = 0.1 } = {}) {
  if (!Lenis || reducedMotion()) return null;
  const lenis = new Lenis({ lerp: l });
  if (gsap && ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    ticker.add((_dt, t) => lenis.raf(t * 1000));
  }
  return lenis;
}

/* ---------- section lifecycle contract ---------- */
/**
 * The contract from R06 Interaction Library: setup → run only while visible → destroy.
 *
 * setup(ctx) runs once and may return:
 *   update(dt, time)  called every frame while the section is near the viewport
 *   onEnter()         section came into view (e.g. resume CSS loops, video)
 *   onLeave()         section left the view (e.g. pause CSS loops, video)
 *   onResize()        layout may have changed: section resized, window resized, fonts or images loaded.
 *                     Re-measure here, with transforms cleared (see sticky-card-stack).
 *   renderStatic()    tidy end state for reduced motion; if present, update() is not run.
 *                     The section may stay interactive (clicks can jump straight to end states).
 *   destroy()         remove listeners, dispose WebGL
 *
 * ctx = { el, reduced, fine, small }
 */
export function defineSection(el, setup, { rootMargin = '15% 0px' } = {}) {
  const ctx = { el, reduced: reducedMotion(), fine: finePointer(), small: smallScreen() };
  const api = setup(ctx) || {};
  const animate = !(ctx.reduced && api.renderStatic);
  if (!animate) api.renderStatic();

  let off = null;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (api.onEnter) api.onEnter();
      if (animate && api.update && !off) off = ticker.add(api.update);
    } else {
      if (api.onLeave) api.onLeave();
      if (off) { off(); off = null; }
    }
  }, { rootMargin });
  io.observe(el);

  // Layout can change without the section changing size (fonts, images, content above it),
  // so onResize also listens to window resize, font loading and page load.
  let ro = null;
  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => api.onResize()); };
  if (api.onResize) {
    ro = new ResizeObserver(relayout);
    ro.observe(el);
    window.addEventListener('resize', relayout);
    window.addEventListener('load', relayout, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    relayout();
  }

  return {
    destroy() {
      io.disconnect();
      if (ro) { ro.disconnect(); window.removeEventListener('resize', relayout); }
      cancelAnimationFrame(raf);
      if (off) off();
      if (api.destroy) api.destroy();
    },
  };
}
